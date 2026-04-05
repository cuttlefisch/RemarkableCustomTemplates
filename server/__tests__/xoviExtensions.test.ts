// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  mapFirmwareToQmdVersion,
  getExtensionDefs,
  getQmdFilePath,
  validateExclusiveGroups,
  getSupportedVersions,
  classifyQmdFiles,
  normalizeLF,
  sha512Normalized,
  verifyQmdChecksum,
  _resetManifestCache,
} from '../lib/xoviExtensions.ts'

beforeEach(() => {
  _resetManifestCache()
})

describe('mapFirmwareToQmdVersion', () => {
  it('maps a full firmware string to its minor version', () => {
    expect(mapFirmwareToQmdVersion('3.26.1.2')).toBe('3.26')
  })

  it('maps a two-part version directly', () => {
    expect(mapFirmwareToQmdVersion('3.24')).toBe('3.24')
  })

  it('returns null for unsupported versions', () => {
    expect(mapFirmwareToQmdVersion('3.99.0.0')).toBeNull()
    expect(mapFirmwareToQmdVersion('4.0.0')).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(mapFirmwareToQmdVersion('abc')).toBeNull()
    expect(mapFirmwareToQmdVersion('')).toBeNull()
    expect(mapFirmwareToQmdVersion('3')).toBeNull()
  })

  it('handles all supported versions', () => {
    for (const v of getSupportedVersions()) {
      expect(mapFirmwareToQmdVersion(v)).toBe(v)
    }
  })
})

describe('getExtensionDefs', () => {
  it('returns all 5 curated extensions', () => {
    const defs = getExtensionDefs()
    expect(defs).toHaveLength(5)
    const ids = defs.map(d => d.id).sort()
    expect(ids).toEqual([
      'createPagesPaperProSize',
      'createPagesRM2Size',
      'preventNotebookZoomOut',
      'quicksheetUseTemplate',
      'unlockMethodsContent',
    ])
  })

  it('each extension has required fields', () => {
    for (const def of getExtensionDefs()) {
      expect(def.id).toBeTruthy()
      expect(def.filename).toMatch(/\.qmd$/)
      expect(def.displayName).toBeTruthy()
      expect(def.description).toBeTruthy()
      expect([1, 2]).toContain(def.tier)
      expect(def.category).toBeTruthy()
    }
  })

  it('page size extensions have exclusiveGroup', () => {
    const defs = getExtensionDefs()
    const rm2 = defs.find(d => d.id === 'createPagesRM2Size')!
    const pp = defs.find(d => d.id === 'createPagesPaperProSize')!
    expect(rm2.exclusiveGroup).toBe('pageSize')
    expect(pp.exclusiveGroup).toBe('pageSize')
  })

  it('non-exclusive extensions have no exclusiveGroup', () => {
    const defs = getExtensionDefs()
    const unlock = defs.find(d => d.id === 'unlockMethodsContent')!
    expect(unlock.exclusiveGroup).toBeUndefined()
  })
})

describe('getQmdFilePath', () => {
  it('resolves a valid extension + version to an absolute path', () => {
    const path = getQmdFilePath('unlockMethodsContent', '3.26')
    expect(path).toMatch(/server\/data\/xovi-extensions\/3\.26\/unlockMethodsContent\.qmd$/)
  })

  it('throws for unknown extension', () => {
    expect(() => getQmdFilePath('nonexistent', '3.26')).toThrow('Unknown extension')
  })

  it('throws for unsupported version', () => {
    expect(() => getQmdFilePath('unlockMethodsContent', '3.99')).toThrow('Unsupported QMD version')
  })

  it('throws for extension not available in a version (quicksheetUseTemplate in 3.22)', () => {
    expect(() => getQmdFilePath('quicksheetUseTemplate', '3.22')).toThrow('QMD file not found')
  })

  it('resolves quicksheetUseTemplate in 3.25+', () => {
    const path = getQmdFilePath('quicksheetUseTemplate', '3.25')
    expect(path).toMatch(/3\.25\/quicksheetUseTemplate\.qmd$/)
  })
})

describe('validateExclusiveGroups', () => {
  it('returns null for non-conflicting extensions', () => {
    expect(validateExclusiveGroups(['unlockMethodsContent', 'createPagesRM2Size'])).toBeNull()
    expect(validateExclusiveGroups(['unlockMethodsContent', 'preventNotebookZoomOut', 'quicksheetUseTemplate'])).toBeNull()
  })

  it('returns null for a single page-size extension', () => {
    expect(validateExclusiveGroups(['createPagesRM2Size'])).toBeNull()
    expect(validateExclusiveGroups(['createPagesPaperProSize'])).toBeNull()
  })

  it('returns error when both page-size extensions are selected', () => {
    const err = validateExclusiveGroups(['createPagesRM2Size', 'createPagesPaperProSize'])
    expect(err).toMatch(/mutually exclusive/)
    expect(err).toMatch(/pageSize/)
  })

  it('returns error for unknown extension', () => {
    const err = validateExclusiveGroups(['unknownExt'])
    expect(err).toMatch(/Unknown extension/)
  })

  it('returns null for empty array', () => {
    expect(validateExclusiveGroups([])).toBeNull()
  })
})

describe('getSupportedVersions', () => {
  it('returns sorted version strings', () => {
    const versions = getSupportedVersions()
    expect(versions.length).toBeGreaterThanOrEqual(5)
    expect(versions).toContain('3.22')
    expect(versions).toContain('3.26')
    // Verify sorted
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i] > versions[i - 1]).toBe(true)
    }
  })
})

describe('classifyQmdFiles', () => {
  const defs = getExtensionDefs()

  it('classifies all known files correctly', () => {
    const knownFiles = defs.map(d => d.filename)
    const result = classifyQmdFiles(knownFiles, defs)
    expect(result.known).toEqual(knownFiles.sort())
    expect(result.unknown).toEqual([])
  })

  it('classifies all unknown files correctly', () => {
    const result = classifyQmdFiles(['userPatch.qmd', 'custom.qmd'], defs)
    expect(result.known).toEqual([])
    expect(result.unknown).toEqual(['custom.qmd', 'userPatch.qmd'])
  })

  it('splits mixed known and unknown files', () => {
    const result = classifyQmdFiles(
      ['unlockMethodsContent.qmd', 'myCustomPatch.qmd', 'preventNotebookZoomOut.qmd'],
      defs,
    )
    expect(result.known).toEqual(['preventNotebookZoomOut.qmd', 'unlockMethodsContent.qmd'])
    expect(result.unknown).toEqual(['myCustomPatch.qmd'])
  })

  it('returns empty arrays for empty input', () => {
    const result = classifyQmdFiles([], defs)
    expect(result.known).toEqual([])
    expect(result.unknown).toEqual([])
  })

  it('returns empty arrays for empty defs', () => {
    const result = classifyQmdFiles(['a.qmd'], [])
    expect(result.known).toEqual([])
    expect(result.unknown).toEqual(['a.qmd'])
  })
})

// ── checksum utilities ──────────────────────────────────────────────────────

describe('normalizeLF', () => {
  it('returns the same buffer when no CR bytes present', () => {
    const buf = Buffer.from('hello\nworld\n')
    const result = normalizeLF(buf)
    expect(result).toEqual(buf)
  })

  it('strips CR from CRLF sequences', () => {
    const buf = Buffer.from('hello\r\nworld\r\n')
    const result = normalizeLF(buf)
    expect(result).toEqual(Buffer.from('hello\nworld\n'))
  })

  it('preserves bare CR that is not followed by LF', () => {
    const buf = Buffer.from('hello\rworld\n')
    const result = normalizeLF(buf)
    expect(result).toEqual(Buffer.from('hello\rworld\n'))
  })

  it('handles mixed line endings', () => {
    const buf = Buffer.from('a\r\nb\nc\r\nd\r')
    const result = normalizeLF(buf)
    expect(result).toEqual(Buffer.from('a\nb\nc\nd\r'))
  })

  it('handles empty buffer', () => {
    const result = normalizeLF(Buffer.alloc(0))
    expect(result.length).toBe(0)
  })
})

describe('sha512Normalized', () => {
  it('produces same hash for LF and CRLF versions of the same content', () => {
    const lf = Buffer.from('line1\nline2\nline3\n')
    const crlf = Buffer.from('line1\r\nline2\r\nline3\r\n')
    expect(sha512Normalized(lf)).toBe(sha512Normalized(crlf))
  })

  it('produces a 128-character hex string', () => {
    const hash = sha512Normalized(Buffer.from('test'))
    expect(hash).toMatch(/^[0-9a-f]{128}$/)
  })
})

describe('verifyQmdChecksum', () => {
  it('verifies a known good QMD file', () => {
    const result = verifyQmdChecksum('unlockMethodsContent', '3.26',
      getQmdFilePath('unlockMethodsContent', '3.26'))
    expect(result.ok).toBe(true)
    expect(result.expected).toBeTruthy()
    expect(result.actual).toBe(result.expected)
  })

  it('verifies all bundled QMD files pass checksum', () => {
    for (const version of getSupportedVersions()) {
      for (const def of getExtensionDefs()) {
        let filePath: string
        try {
          filePath = getQmdFilePath(def.id, version)
        } catch {
          continue // extension not available in this version
        }
        const result = verifyQmdChecksum(def.id, version, filePath)
        expect(result.ok, `${def.id}@${version}`).toBe(true)
      }
    }
  })

  it('detects a tampered file', () => {
    const filePath = getQmdFilePath('unlockMethodsContent', '3.26')
    const content = readFileSync(filePath)
    const tampered = Buffer.concat([content, Buffer.from('X')])
    const tmpPath = resolve(tmpdir(), `tampered-${Date.now()}.qmd`)
    writeFileSync(tmpPath, tampered)
    try {
      const result = verifyQmdChecksum('unlockMethodsContent', '3.26', tmpPath)
      expect(result.ok).toBe(false)
      expect(result.actual).not.toBe(result.expected)
    } finally {
      unlinkSync(tmpPath)
    }
  })

  it('throws for unknown extension', () => {
    expect(() => verifyQmdChecksum('nonexistent', '3.26', '/tmp/fake.qmd'))
      .toThrow('Unknown extension')
  })
})
