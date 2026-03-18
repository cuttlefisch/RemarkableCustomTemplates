import { describe, it, expect } from 'vitest'
import {
  bumpPatchVersion,
  templateContentHash,
  resolveTemplateVersion,
  buildRmMethodsMetadata,
} from '../lib/rmMethods'
import type { ManifestEntry } from '../lib/rmMethods'

// ---------------------------------------------------------------------------
// bumpPatchVersion
// ---------------------------------------------------------------------------

describe('bumpPatchVersion', () => {
  it('bumps 1.0.0 → 1.0.1', () => {
    expect(bumpPatchVersion('1.0.0')).toBe('1.0.1')
  })

  it('bumps 1.0.9 → 1.0.10', () => {
    expect(bumpPatchVersion('1.0.9')).toBe('1.0.10')
  })

  it('bumps 1.2.3 → 1.2.4', () => {
    expect(bumpPatchVersion('1.2.3')).toBe('1.2.4')
  })

  it('handles two-segment version 1.0 → 1.1', () => {
    expect(bumpPatchVersion('1.0')).toBe('1.1')
  })
})

// ---------------------------------------------------------------------------
// templateContentHash
// ---------------------------------------------------------------------------

describe('templateContentHash', () => {
  const base = {
    name: 'Test',
    author: 'me',
    formatVersion: 2,
    orientation: 'portrait',
    constants: [],
    items: [{ type: 'text', value: 'hello' }],
  }

  it('produces a sha256-prefixed hex string', () => {
    const hash = templateContentHash(base)
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('is deterministic (same input → same hash)', () => {
    expect(templateContentHash(base)).toBe(templateContentHash({ ...base }))
  })

  it('ignores templateVersion changes', () => {
    const a = { ...base, templateVersion: '1.0.0' }
    const b = { ...base, templateVersion: '1.0.1' }
    expect(templateContentHash(a)).toBe(templateContentHash(b))
  })

  it('ignores iconData changes', () => {
    const a = { ...base, iconData: 'data:image/png;base64,AAA' }
    const b = { ...base, iconData: 'data:image/png;base64,BBB' }
    expect(templateContentHash(a)).toBe(templateContentHash(b))
  })

  it('changes when semantic content changes', () => {
    const modified = { ...base, name: 'Different' }
    expect(templateContentHash(base)).not.toBe(templateContentHash(modified))
  })
})

// ---------------------------------------------------------------------------
// resolveTemplateVersion
// ---------------------------------------------------------------------------

describe('resolveTemplateVersion', () => {
  const hash1 = 'sha256:aaa'
  const hash2 = 'sha256:bbb'

  it('returns sourceVersion when no previous entry exists', () => {
    expect(
      resolveTemplateVersion({ currentHash: hash1, sourceVersion: '1.0.0' }),
    ).toBe('1.0.0')
  })

  it('keeps previous version when content hash matches', () => {
    const prevEntry: ManifestEntry = {
      name: 'T',
      templateVersion: '1.0.3',
      contentHash: hash1,
      createdTime: '1000',
    }
    expect(
      resolveTemplateVersion({ prevEntry, currentHash: hash1, sourceVersion: '1.0.0' }),
    ).toBe('1.0.3')
  })

  it('bumps previous version when content hash differs', () => {
    const prevEntry: ManifestEntry = {
      name: 'T',
      templateVersion: '1.0.3',
      contentHash: hash1,
      createdTime: '1000',
    }
    expect(
      resolveTemplateVersion({ prevEntry, currentHash: hash2, sourceVersion: '1.0.0' }),
    ).toBe('1.0.4')
  })
})

// ---------------------------------------------------------------------------
// buildRmMethodsMetadata
// ---------------------------------------------------------------------------

describe('buildRmMethodsMetadata', () => {
  it('produces all required fields with correct types', () => {
    const meta = buildRmMethodsMetadata({
      visibleName: 'My Template',
      nowMs: '1710672000000',
    })
    expect(meta).toEqual({
      createdTime: '1710672000000',
      lastModified: '1710672000000',
      new: false,
      parent: '',
      pinned: false,
      source: 'com.remarkable.methods',
      type: 'TemplateType',
      visibleName: 'My Template',
    })
  })

  it('preserves createdTime from previous export', () => {
    const meta = buildRmMethodsMetadata({
      visibleName: 'My Template',
      createdTime: '1700000000000',
      nowMs: '1710672000000',
    })
    expect(meta.createdTime).toBe('1700000000000')
    expect(meta.lastModified).toBe('1710672000000')
  })

  it('uses nowMs for createdTime when not provided', () => {
    const meta = buildRmMethodsMetadata({
      visibleName: 'Test',
      nowMs: '1710672000000',
    })
    expect(meta.createdTime).toBe('1710672000000')
  })
})
