import { describe, it, expect } from 'vitest'
import {
  buildBackupManifest,
  validateBackupContents,
  computeMergeActions,
} from '../lib/backup'
import { strToU8 } from 'fflate'

function makeZip(files: Record<string, string>): Record<string, Uint8Array> {
  const result: Record<string, Uint8Array> = {}
  for (const [k, v] of Object.entries(files)) {
    result[k] = strToU8(v)
  }
  return result
}

function minimalTemplate(name = 'Test'): string {
  return JSON.stringify({
    name,
    author: 'Test',
    templateVersion: '1.0.0',
    formatVersion: 1,
    categories: ['Custom'],
    orientation: 'portrait',
    constants: [],
    items: [],
  })
}

function minimalRegistry(entries: Array<{ name: string; filename: string; rmMethodsId?: string }>): string {
  return JSON.stringify({
    templates: entries.map(e => ({
      name: e.name,
      filename: e.filename,
      iconCode: '\ue9d8',
      landscape: false,
      categories: ['Custom'],
      ...(e.rmMethodsId ? { rmMethodsId: e.rmMethodsId } : {}),
    })),
  })
}

// ---------------------------------------------------------------------------
// buildBackupManifest
// ---------------------------------------------------------------------------

describe('buildBackupManifest', () => {
  it('builds correct structure with ISO timestamp', () => {
    const manifest = buildBackupManifest(3, 1)
    expect(manifest.version).toBe(1)
    expect(manifest.templateCount).toEqual({ custom: 3, debug: 1 })
    // ISO 8601 format check
    expect(new Date(manifest.createdAt).toISOString()).toBe(manifest.createdAt)
  })

  it('handles zero counts', () => {
    const manifest = buildBackupManifest(0, 0)
    expect(manifest.templateCount).toEqual({ custom: 0, debug: 0 })
  })
})

// ---------------------------------------------------------------------------
// validateBackupContents
// ---------------------------------------------------------------------------

describe('validateBackupContents', () => {
  it('validates a complete backup (custom + debug)', () => {
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString(), templateCount: { custom: 1, debug: 1 } }),
      'custom/custom-registry.json': minimalRegistry([{ name: 'My Grid', filename: 'custom/P My Grid', rmMethodsId: 'uuid-1' }]),
      'custom/P My Grid.template': minimalTemplate('My Grid'),
      'debug/debug-registry.json': minimalRegistry([{ name: 'Debug T', filename: 'debug/P Debug T', rmMethodsId: 'uuid-2' }]),
      'debug/P Debug T.template': minimalTemplate('Debug T'),
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.customTemplateFiles).toEqual(['custom/P My Grid.template'])
    expect(result.debugTemplateFiles).toEqual(['debug/P Debug T.template'])
  })

  it('validates a custom-only backup', () => {
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString(), templateCount: { custom: 1, debug: 0 } }),
      'custom/custom-registry.json': minimalRegistry([{ name: 'A', filename: 'custom/P A', rmMethodsId: 'u1' }]),
      'custom/P A.template': minimalTemplate('A'),
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(true)
  })

  it('errors on missing manifest', () => {
    const files = makeZip({
      'custom/custom-registry.json': minimalRegistry([]),
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing backup-manifest.json')
  })

  it('errors on wrong manifest version', () => {
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 99 }),
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('version'))).toBe(true)
  })

  it('errors on invalid registry JSON', () => {
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString(), templateCount: { custom: 0, debug: 0 } }),
      'custom/custom-registry.json': 'not json',
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('custom registry'))).toBe(true)
  })

  it('errors on invalid template file (includes filename)', () => {
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString(), templateCount: { custom: 1, debug: 0 } }),
      'custom/custom-registry.json': minimalRegistry([{ name: 'Bad', filename: 'custom/P Bad' }]),
      'custom/P Bad.template': 'not json at all',
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('P Bad.template'))).toBe(true)
  })

  it('warns on missing template file referenced by registry', () => {
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString(), templateCount: { custom: 1, debug: 0 } }),
      'custom/custom-registry.json': minimalRegistry([{ name: 'Missing', filename: 'custom/P Missing' }]),
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes('P Missing.template'))).toBe(true)
  })

  it('warns on orphan template files', () => {
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString(), templateCount: { custom: 0, debug: 0 } }),
      'custom/custom-registry.json': minimalRegistry([]),
      'custom/P Orphan.template': minimalTemplate('Orphan'),
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes('Orphan'))).toBe(true)
  })

  it('warns on entries missing rmMethodsId', () => {
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString(), templateCount: { custom: 1, debug: 0 } }),
      'custom/custom-registry.json': minimalRegistry([{ name: 'NoUuid', filename: 'custom/P NoUuid' }]),
      'custom/P NoUuid.template': minimalTemplate('NoUuid'),
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes('rmMethodsId'))).toBe(true)
  })

  it('validates a backup whose template was re-serialized from trailing-comma source', () => {
    // Simulate the backup endpoint re-serializing a template that originally had trailing commas.
    // After JSON.parse → JSON.stringify, the result should be valid and pass validation.
    const trailingCommaSource = '{"name":"TC","author":"x","templateVersion":"1.0.0","formatVersion":1,"categories":["Custom"],"orientation":"portrait","constants":[],"items":[]}'
    const reSerialized = JSON.stringify(JSON.parse(trailingCommaSource), null, 2)
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString(), templateCount: { custom: 1, debug: 0 } }),
      'custom/custom-registry.json': minimalRegistry([{ name: 'TC', filename: 'custom/P TC', rmMethodsId: 'uuid-tc' }]),
      'custom/P TC.template': reSerialized,
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('errors on completely empty backup', () => {
    const files = makeZip({
      'backup-manifest.json': JSON.stringify({ version: 1, createdAt: new Date().toISOString(), templateCount: { custom: 0, debug: 0 } }),
    })
    const result = validateBackupContents(files)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('empty'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeMergeActions
// ---------------------------------------------------------------------------

describe('computeMergeActions', () => {
  it('adds all when no overlap', () => {
    const incoming = [
      { name: 'A', filename: 'custom/P A', rmMethodsId: 'uuid-a', iconCode: '\ue9d8', categories: ['Custom'] as string[], landscape: false },
    ]
    const existing = [
      { name: 'B', filename: 'custom/P B', rmMethodsId: 'uuid-b', iconCode: '\ue9d8', categories: ['Custom'] as string[], landscape: false },
    ]
    const actions = computeMergeActions(incoming, existing)
    expect(actions).toEqual([{ entry: incoming[0], action: 'add' }])
  })

  it('skips when UUID matches', () => {
    const entry = { name: 'A', filename: 'custom/P A', rmMethodsId: 'uuid-a', iconCode: '\ue9d8', categories: ['Custom'] as string[], landscape: false }
    const actions = computeMergeActions([entry], [entry])
    expect(actions).toEqual([{ entry, action: 'skip', reason: 'UUID match' }])
  })

  it('skips when filename matches', () => {
    const incoming = { name: 'A', filename: 'custom/P A', iconCode: '\ue9d8', categories: ['Custom'] as string[], landscape: false }
    const existing = { name: 'A Different', filename: 'custom/P A', rmMethodsId: 'uuid-x', iconCode: '\ue9d8', categories: ['Custom'] as string[], landscape: false }
    const actions = computeMergeActions([incoming], [existing])
    expect(actions).toEqual([{ entry: incoming, action: 'skip', reason: 'filename match' }])
  })

  it('handles mixed add/skip', () => {
    const incoming = [
      { name: 'A', filename: 'custom/P A', rmMethodsId: 'uuid-a', iconCode: '\ue9d8', categories: ['Custom'] as string[], landscape: false },
      { name: 'B', filename: 'custom/P B', rmMethodsId: 'uuid-b', iconCode: '\ue9d8', categories: ['Custom'] as string[], landscape: false },
    ]
    const existing = [
      { name: 'A', filename: 'custom/P A', rmMethodsId: 'uuid-a', iconCode: '\ue9d8', categories: ['Custom'] as string[], landscape: false },
    ]
    const actions = computeMergeActions(incoming, existing)
    expect(actions[0].action).toBe('skip')
    expect(actions[1].action).toBe('add')
  })
})
