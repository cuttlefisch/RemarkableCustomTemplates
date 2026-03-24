// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import {
  mapFirmwareToQmdVersion,
  getExtensionDefs,
  getQmdFilePath,
  validateExclusiveGroups,
  getSupportedVersions,
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
