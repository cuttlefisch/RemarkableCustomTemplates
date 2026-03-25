import { describe, it, expect } from 'vitest'
import {
  expandPageGroups,
  generateNotebookContent,
  generateNotebookMetadata,
  generateNotebookLocal,
  generateFractionalIndex,
  generateCrdtTimestamp,
  resolveTemplateRef,
  generateEmptyRmFile,
  EMPTY_RM_FILE_SIZE,
} from '../lib/notebookGenerator'
import type { PageGroup, NotebookContent, NotebookMetadata } from '../types/notebook'
import type { TemplateRegistryEntry } from '../types/registry'

const makeGroup = (overrides: Partial<PageGroup> = {}): PageGroup => ({
  id: 'group-1',
  templateRef: 'Blank',
  templateName: 'Blank',
  count: 1,
  ...overrides,
})

describe('generateCrdtTimestamp', () => {
  it('formats as replicaId:sequenceNumber', () => {
    expect(generateCrdtTimestamp(1, 5)).toBe('1:5')
    expect(generateCrdtTimestamp(2, 0)).toBe('2:0')
  })
})

describe('generateFractionalIndex', () => {
  it('generates sequential indices starting from "ba"', () => {
    expect(generateFractionalIndex(0)).toBe('ba')
    expect(generateFractionalIndex(1)).toBe('bb')
    expect(generateFractionalIndex(2)).toBe('bc')
  })

  it('generates correct sequence through alphabet', () => {
    const indices = Array.from({ length: 25 }, (_, i) => generateFractionalIndex(i))
    expect(indices[0]).toBe('ba')
    expect(indices[24]).toBe('by')
  })

  it('wraps to multi-character indices after z', () => {
    const idx25 = generateFractionalIndex(25)
    expect(idx25).toBe('bz')
    // After bz, should continue with longer strings
    const idx26 = generateFractionalIndex(26)
    expect(idx26.length).toBeGreaterThanOrEqual(2)
    // Indices should remain sorted
    expect(idx26 > idx25).toBe(true)
  })

  it('throws for positions >= 18278', () => {
    expect(() => generateFractionalIndex(18278)).toThrow()
    expect(() => generateFractionalIndex(20000)).toThrow()
  })

  it('produces strictly ascending values for 100+ pages', () => {
    const indices = Array.from({ length: 150 }, (_, i) => generateFractionalIndex(i))
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i] > indices[i - 1]).toBe(true)
    }
  })
})

describe('expandPageGroups', () => {
  it('flattens single group with count=1', () => {
    const groups = [makeGroup({ count: 1, templateRef: 'Blank', templateName: 'Blank' })]
    const pages = expandPageGroups(groups)
    expect(pages).toHaveLength(1)
    expect(pages[0].templateRef).toBe('Blank')
    expect(pages[0].templateName).toBe('Blank')
    expect(pages[0].id).toBeDefined()
  })

  it('flattens single group with count > 1', () => {
    const groups = [makeGroup({ count: 3, templateRef: 'Dots', templateName: 'Dots' })]
    const pages = expandPageGroups(groups)
    expect(pages).toHaveLength(3)
    pages.forEach(p => {
      expect(p.templateRef).toBe('Dots')
      expect(p.templateName).toBe('Dots')
    })
  })

  it('each page gets a unique id', () => {
    const groups = [makeGroup({ count: 5 })]
    const pages = expandPageGroups(groups)
    const ids = new Set(pages.map(p => p.id))
    expect(ids.size).toBe(5)
  })

  it('flattens multiple groups in order', () => {
    const groups = [
      makeGroup({ id: 'g1', count: 2, templateRef: 'Blank', templateName: 'Blank' }),
      makeGroup({ id: 'g2', count: 3, templateRef: 'Grid', templateName: 'Grid' }),
    ]
    const pages = expandPageGroups(groups)
    expect(pages).toHaveLength(5)
    expect(pages[0].templateRef).toBe('Blank')
    expect(pages[1].templateRef).toBe('Blank')
    expect(pages[2].templateRef).toBe('Grid')
    expect(pages[3].templateRef).toBe('Grid')
    expect(pages[4].templateRef).toBe('Grid')
  })

  it('handles empty groups array', () => {
    expect(expandPageGroups([])).toEqual([])
  })

  it('skips groups with count=0', () => {
    const groups = [makeGroup({ count: 0 })]
    expect(expandPageGroups(groups)).toEqual([])
  })

  it('normalizes :portrait to :p in template refs', () => {
    const groups = [makeGroup({ count: 1, templateRef: 'a1b2c3d4-0001-4000-8000-000000000001:portrait' })]
    const pages = expandPageGroups(groups)
    expect(pages[0].templateRef).toBe('a1b2c3d4-0001-4000-8000-000000000001:p')
  })

  it('normalizes :landscape to :l in template refs', () => {
    const groups = [makeGroup({ count: 1, templateRef: 'a1b2c3d4-0004-4000-8000-000000000004:landscape' })]
    const pages = expandPageGroups(groups)
    expect(pages[0].templateRef).toBe('a1b2c3d4-0004-4000-8000-000000000004:l')
  })

  it('leaves :p and :l template refs unchanged', () => {
    const groups = [
      makeGroup({ count: 1, templateRef: 'abc-123:p' }),
      makeGroup({ count: 1, templateRef: 'def-456:l' }),
    ]
    const pages = expandPageGroups(groups)
    expect(pages[0].templateRef).toBe('abc-123:p')
    expect(pages[1].templateRef).toBe('def-456:l')
  })

  it('leaves classic template names unchanged', () => {
    const groups = [makeGroup({ count: 1, templateRef: 'Blank' })]
    const pages = expandPageGroups(groups)
    expect(pages[0].templateRef).toBe('Blank')
  })
})

describe('resolveTemplateRef', () => {
  it('returns name for classic templates (no rmMethodsId)', () => {
    const entry: TemplateRegistryEntry = {
      name: 'Blank',
      filename: 'Blank',
      iconCode: '\\ue9fe',
      categories: ['Creative'],
    }
    expect(resolveTemplateRef(entry)).toBe('Blank')
  })

  it('returns uuid:p for portrait methods template', () => {
    const entry: TemplateRegistryEntry = {
      name: 'Custom Grid',
      filename: 'custom/P Custom Grid',
      iconCode: '\\ue9fe',
      categories: ['Custom'],
      rmMethodsId: '66d2157c-8682-4b3b-8787-4855c5afcb99',
    }
    expect(resolveTemplateRef(entry)).toBe('66d2157c-8682-4b3b-8787-4855c5afcb99:p')
  })

  it('returns uuid:l for landscape methods template', () => {
    const entry: TemplateRegistryEntry = {
      name: 'Wide Grid',
      filename: 'custom/LS Wide Grid',
      iconCode: '\\ue9fe',
      landscape: true,
      categories: ['Custom'],
      rmMethodsId: 'abcdef01-2345-6789-abcd-ef0123456789',
    }
    expect(resolveTemplateRef(entry)).toBe('abcdef01-2345-6789-abcd-ef0123456789:l')
  })
})

describe('generateNotebookMetadata', () => {
  it('produces DocumentType metadata with correct fields', () => {
    const metadata = generateNotebookMetadata('My Notebook') as NotebookMetadata
    expect(metadata.type).toBe('DocumentType')
    expect(metadata.visibleName).toBe('My Notebook')
    expect(metadata.version).toBe(0)
    expect(metadata.deleted).toBe(false)
    expect(metadata.pinned).toBe(false)
    expect(metadata.parent).toBe('')
    expect(metadata.synced).toBe(false)
    expect(metadata.source).toBe('')
  })

  it('has valid epoch ms timestamps', () => {
    const before = Date.now()
    const metadata = generateNotebookMetadata('Test') as NotebookMetadata
    const after = Date.now()

    const created = Number(metadata.createdTime)
    const modified = Number(metadata.lastModified)
    const opened = Number(metadata.lastOpened)

    expect(created).toBeGreaterThanOrEqual(before)
    expect(created).toBeLessThanOrEqual(after)
    expect(modified).toBeGreaterThanOrEqual(before)
    expect(opened).toBeGreaterThanOrEqual(before)
  })

  it('lastOpenedPage is 0', () => {
    const metadata = generateNotebookMetadata('Test') as NotebookMetadata
    expect(metadata.lastOpenedPage).toBe(0)
  })
})

describe('generateNotebookLocal', () => {
  it('returns contentFormatVersion 2', () => {
    expect(generateNotebookLocal()).toEqual({ contentFormatVersion: 2 })
  })
})

describe('generateEmptyRmFile', () => {
  it('returns a Uint8Array for rmPPM', () => {
    const result = generateEmptyRmFile('rmPPM')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result!.length).toBe(EMPTY_RM_FILE_SIZE)
  })

  it('PPM blob starts with reMarkable .lines file header', () => {
    const result = generateEmptyRmFile('rmPPM')!
    const header = new TextDecoder().decode(result.slice(0, 24))
    expect(header).toContain('reMarkable .lines file')
  })

  it('returns null for rm (RM1/RM2)', () => {
    expect(generateEmptyRmFile('rm')).toBeNull()
  })

  it('returns null for rmPP (Paper Pro)', () => {
    expect(generateEmptyRmFile('rmPP')).toBeNull()
  })

  it('returns the same cached instance for rmPPM', () => {
    const a = generateEmptyRmFile('rmPPM')
    const b = generateEmptyRmFile('rmPPM')
    expect(a).toBe(b) // same reference
  })
})

describe('generateNotebookContent', () => {
  const twoGroupPages = expandPageGroups([
    makeGroup({ id: 'g1', count: 2, templateRef: 'Blank', templateName: 'Blank' }),
    makeGroup({ id: 'g2', count: 1, templateRef: '66d2157c-...:p', templateName: 'Dark Dots' }),
  ])

  it('has correct fileType and formatVersion', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(content.fileType).toBe('notebook')
    expect(content.formatVersion).toBe(2)
  })

  it('has correct pageCount', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(content.pageCount).toBe(3)
  })

  it('has cPages with correct number of pages', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(content.cPages.pages).toHaveLength(3)
  })

  it('page ids match expanded page ids', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    const pageIds = content.cPages.pages.map(p => p.id)
    const expectedIds = twoGroupPages.map(p => p.id)
    expect(pageIds).toEqual(expectedIds)
  })

  it('page template refs match expanded pages', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(content.cPages.pages[0].template.value).toBe('Blank')
    expect(content.cPages.pages[1].template.value).toBe('Blank')
    expect(content.cPages.pages[2].template.value).toBe('66d2157c-...:p')
  })

  it('fractional indices are ascending', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    const indices = content.cPages.pages.map(p => p.idx.value)
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i] > indices[i - 1]).toBe(true)
    }
  })

  it('CRDT timestamps have sequential sequence numbers', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    const timestamps = content.cPages.pages.map(p => {
      const [, seq] = p.idx.timestamp.split(':')
      return Number(seq)
    })
    // All idx timestamps should share the same replica and have sequential seqs
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1])
    }
  })

  it('has cPages.uuids array', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(Array.isArray(content.cPages.uuids)).toBe(true)
    expect(content.cPages.uuids.length).toBeGreaterThan(0)
    expect(content.cPages.uuids[0]).toHaveProperty('first')
    expect(content.cPages.uuids[0]).toHaveProperty('second')
  })

  it('has cPages.original with value -1', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(content.cPages.original.value).toBe(-1)
  })

  it('has cPages.lastOpened pointing to first page', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(content.cPages.lastOpened.value).toBe(twoGroupPages[0].id)
  })

  it('has default orientation portrait', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(content.orientation).toBe('portrait')
  })

  it('respects landscape orientation', () => {
    const content = generateNotebookContent(twoGroupPages, 'landscape') as NotebookContent
    expect(content.orientation).toBe('landscape')
  })

  it('has coverPageNumber -1', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(content.coverPageNumber).toBe(-1)
  })

  it('has zoomMode bestFit', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(content.zoomMode).toBe('bestFit')
  })

  it('has extraMetadata object', () => {
    const content = generateNotebookContent(twoGroupPages) as NotebookContent
    expect(typeof content.extraMetadata).toBe('object')
  })

  it('handles single page notebook', () => {
    const pages = expandPageGroups([makeGroup({ count: 1 })])
    const content = generateNotebookContent(pages) as NotebookContent
    expect(content.pageCount).toBe(1)
    expect(content.cPages.pages).toHaveLength(1)
  })

  it('handles large notebook (100 pages)', () => {
    const pages = expandPageGroups([makeGroup({ count: 100 })])
    const content = generateNotebookContent(pages) as NotebookContent
    expect(content.pageCount).toBe(100)
    expect(content.cPages.pages).toHaveLength(100)
    // All indices must be ascending
    const indices = content.cPages.pages.map(p => p.idx.value)
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i] > indices[i - 1]).toBe(true)
    }
  })

  it('defaults to RM1/2 dimensions (1404x1872)', () => {
    const pages = expandPageGroups([makeGroup({ count: 1 })])
    const content = generateNotebookContent(pages, 'portrait') as NotebookContent
    expect(content.customZoomPageWidth).toBe(1404)
    expect(content.customZoomPageHeight).toBe(1872)
  })

  it('uses 1404x1872 even when deviceId is rmPP (all devices share notebook coords)', () => {
    const pages = expandPageGroups([makeGroup({ count: 1 })])
    const content = generateNotebookContent(pages, 'portrait', 'rmPP') as NotebookContent
    expect(content.customZoomPageWidth).toBe(1404)
    expect(content.customZoomPageHeight).toBe(1872)
  })

  it('uses 1404x1872 even when deviceId is rmPPM (all devices share notebook coords)', () => {
    const pages = expandPageGroups([makeGroup({ count: 1 })])
    const content = generateNotebookContent(pages, 'portrait', 'rmPPM') as NotebookContent
    expect(content.customZoomPageWidth).toBe(1404)
    expect(content.customZoomPageHeight).toBe(1872)
  })

  it('swaps width/height for landscape orientation', () => {
    const pages = expandPageGroups([makeGroup({ count: 1 })])
    const content = generateNotebookContent(pages, 'landscape', 'rmPP') as NotebookContent
    expect(content.customZoomPageWidth).toBe(1872)
    expect(content.customZoomPageHeight).toBe(1404)
  })
})
