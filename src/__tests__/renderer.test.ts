import { describe, it, expect } from 'vitest'
import {
  formatNum,
  pathDataToSvgD,
  estimateTextWidth,
  computeTileRange,
  deviceBuiltins,
  collectMissingConstants,
  DEVICES,
} from '../lib/renderer'
import type { DeviceId } from '../lib/renderer'
import type { RemarkableTemplate, TemplateItem, ConstantEntry } from '../types/template'

// ─── formatNum ────────────────────────────────────────────────────────────────

describe('formatNum', () => {
  it('formats integers without decimals', () => {
    expect(formatNum(0)).toBe('0')
    expect(formatNum(1404)).toBe('1404')
    expect(formatNum(-259)).toBe('-259')
  })

  it('trims trailing zeros from decimals', () => {
    expect(formatNum(177.8)).toBe('177.8')
    expect(formatNum(78.7)).toBe('78.7')
    expect(formatNum(42.5)).toBe('42.5')
  })

  it('rounds to 4 decimal places', () => {
    expect(formatNum(1 / 3)).toBe('0.3333')
    expect(formatNum(2 / 3)).toBe('0.6667')
    expect(formatNum(Math.PI)).toBe('3.1416')
  })

  it('handles negative decimals', () => {
    expect(formatNum(-24.3)).toBe('-24.3')
  })
})

// ─── pathDataToSvgD ───────────────────────────────────────────────────────────

describe('pathDataToSvgD', () => {
  it('converts a simple M command', () => {
    expect(pathDataToSvgD(['M', 0, 0], {})).toBe('M 0 0')
  })

  it('converts M then L (line segment)', () => {
    expect(pathDataToSvgD(['M', 0, 146, 'L', 1404, 146], {})).toBe('M 0 146 L 1404 146')
  })

  it('converts a closed polygon (Z)', () => {
    expect(pathDataToSvgD(['M', 0, 0, 'L', 1, 0, 'L', 1, 1, 'L', 0, 1, 'Z'], {})).toBe(
      'M 0 0 L 1 0 L 1 1 L 0 1 Z',
    )
  })

  it('converts a cubic bezier curve (C takes 6 coords)', () => {
    expect(
      pathDataToSvgD(['M', 0, 102.5, 'C', 2.1, 103.5, 3.9, 105.2, 5.4, 107], {}),
    ).toBe('M 0 102.5 C 2.1 103.5 3.9 105.2 5.4 107')
  })

  it('converts multiple sub-paths separated by M', () => {
    const data = ['M', 0, 100, 'L', 1404, 100, 'M', 0, 200, 'L', 1404, 200]
    expect(pathDataToSvgD(data, {})).toBe('M 0 100 L 1404 100 M 0 200 L 1404 200')
  })

  it('resolves named constant expressions', () => {
    const data = ['M', 0, 'yHeader', 'L', 'templateWidth', 'yHeader']
    expect(pathDataToSvgD(data, { yHeader: 146, templateWidth: 1404 })).toBe(
      'M 0 146 L 1404 146',
    )
  })

  it('resolves arithmetic expressions', () => {
    const data = ['M', 'templateWidth / 2', 0, 'L', 'templateWidth / 2', 'templateHeight']
    expect(pathDataToSvgD(data, { templateWidth: 1404, templateHeight: 1872 })).toBe(
      'M 702 0 L 702 1872',
    )
  })

  it('uses parentWidth and parentHeight as constants', () => {
    const data = ['M', 0, 0, 'L', 'parentWidth', 0]
    expect(pathDataToSvgD(data, { parentWidth: 1104 })).toBe('M 0 0 L 1104 0')
  })

  it('formats fractional coordinates to 4 decimal places max', () => {
    const data = ['M', 0, 'h / 3']
    expect(pathDataToSvgD(data, { h: 100 })).toBe('M 0 33.3333')
  })

  it('returns empty string for empty data array', () => {
    expect(pathDataToSvgD([], {})).toBe('')
  })
})

// ─── estimateTextWidth ────────────────────────────────────────────────────────

describe('estimateTextWidth', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTextWidth('', 24)).toBe(0)
  })

  it('scales with character count', () => {
    const w1 = estimateTextWidth('A', 24)
    const w4 = estimateTextWidth('ABCD', 24)
    expect(w4).toBe(w1 * 4)
  })

  it('scales with font size', () => {
    const w24 = estimateTextWidth('Week', 24)
    const w48 = estimateTextWidth('Week', 48)
    expect(w48).toBe(w24 * 2)
  })

  it('produces a positive value for non-empty text', () => {
    expect(estimateTextWidth('Monday', 32)).toBeGreaterThan(0)
  })
})

// ─── computeTileRange ─────────────────────────────────────────────────────────

describe('computeTileRange', () => {
  it('repeat=0: always renders 1 tile at index 0', () => {
    expect(computeTileRange(100, 50, 1872, 0)).toEqual({ start: 0, count: 1 })
  })

  it('repeat=1: renders 1 tile at index 0', () => {
    expect(computeTileRange(100, 50, 1872, 1)).toEqual({ start: 0, count: 1 })
  })

  it('repeat=6: renders exactly 6 tiles starting at index 0', () => {
    expect(computeTileRange(155, 284, 1872, 6)).toEqual({ start: 0, count: 6 })
  })

  it('repeat=2: renders 2 tiles', () => {
    expect(computeTileRange(0, 132, 1872, 2)).toEqual({ start: 0, count: 2 })
  })

  it('"down": fills downward from tile start, no negative tiles', () => {
    // P Lines medium: tileStart=177.8, tileSize=78.7, viewSize=1872
    // lastTile = floor((1872 - 177.8) / 78.7) = floor(21.53) = 21
    const range = computeTileRange(177.8, 78.7, 1872, 'down')
    expect(range.start).toBe(0)
    expect(range.count).toBe(22) // tiles 0..21
  })

  it('"infinite": fills viewport including negative start when tileStart < 0', () => {
    // P Dots S: tileStart=-255, tileSize=42.5, viewSize=1404
    // firstTile = floor((0 - (-255)) / 42.5) = floor(6) = 6... wait
    // Actually: floor(255/42.5) = floor(6) = 6
    // Tile 6 starts at -255 + 6*42.5 = -255 + 255 = 0 (exactly at viewport start)
    const range = computeTileRange(-255, 42.5, 1404, 'infinite')
    expect(range.start).toBe(6)
    // lastTile = floor((1404 - (-255)) / 42.5) = floor(1659/42.5) = floor(39.04) = 39
    // count = 39 - 6 + 1 = 34
    expect(range.count).toBe(34)
  })

  it('"infinite": negative start when tiles begin before viewport', () => {
    // P Lines medium treated as infinite: tileStart=177.8, tiles above viewport exist
    const range = computeTileRange(177.8, 78.7, 1872, 'infinite')
    expect(range.start).toBe(-3) // tiles above viewport
    expect(range.count).toBe(25) // 21 - (-3) + 1
  })

  it('"infinite" for full-page-wide tile: effectively 1 column', () => {
    // hlines group in P Grid small: tileWidth = templateWidth = 1404
    // tile 1 would start at x=1404 (exactly at viewport edge) — zero visible pixels, excluded
    const range = computeTileRange(0, 1404, 1404, 'infinite')
    expect(range.start).toBe(0)
    expect(range.count).toBe(1)
  })

  it('handles tileStart=0 with "down"', () => {
    // 1872 / 52 = 36.0 exactly — tile 36 starts at 1872 (viewport edge), excluded
    const range = computeTileRange(0, 52, 1872, 'down')
    expect(range.start).toBe(0)
    expect(range.count).toBe(36)
  })

  it('"up": fills upward from anchor (lastTile=0), P Grid top hlines', () => {
    // hlines: tileStart=939, tileSize=78.3, viewSize=1872
    // firstTile = floor((0 - 939) / 78.3) = floor(-11.99) = -12
    // lastTile = 0 (never goes past the anchor)
    // count = 0 - (-12) + 1 = 13
    const range = computeTileRange(939, 78.3, 1872, 'up')
    expect(range.start).toBe(-12)
    expect(range.count).toBe(13)
  })

  it('"up": tileStart=0 renders exactly 1 tile at index 0', () => {
    // vlines rows: tileStart=0 — anchor is at top, nothing above
    const range = computeTileRange(0, 78.3, 939, 'up')
    expect(range.start).toBe(0)
    expect(range.count).toBe(1)
  })

  it('"right": fills rightward from tile 0, P Grid margin vlines', () => {
    // xpos = templateWidth/2 - templateHeight/2 + magicOffset = 702 - 936 + 469 = 235
    // tileStart=235, tileSize=78.3, viewSize=1404
    // lastTile = ceil((1404 - 235) / 78.3) - 1 = ceil(14.923) - 1 = 14
    // count = 15
    const range = computeTileRange(235, 78.3, 1404, 'right')
    expect(range.start).toBe(0)
    expect(range.count).toBe(15)
  })

  it('"right": full-width tile (hlines columns) produces exactly 1 tile', () => {
    // hlines: tileStart=235, tileSize=templateWidth=1404, viewSize=1404
    // lastTile = ceil((1404 - 235) / 1404) - 1 = ceil(0.833) - 1 = 0
    // count = 1
    const range = computeTileRange(235, 1404, 1404, 'right')
    expect(range.start).toBe(0)
    expect(range.count).toBe(1)
  })
})

// ─── DEVICES map ─────────────────────────────────────────────────────────────

describe('DEVICES', () => {
  it('rm1 and rm2 share the same screen resolution', () => {
    expect(DEVICES.rm1.portraitWidth).toBe(1404)
    expect(DEVICES.rm1.portraitHeight).toBe(1872)
    expect(DEVICES.rm2.portraitWidth).toBe(DEVICES.rm1.portraitWidth)
    expect(DEVICES.rm2.portraitHeight).toBe(DEVICES.rm1.portraitHeight)
  })

  it('rmPP has a smaller screen', () => {
    expect(DEVICES.rmPP.portraitWidth).toBe(954)
    expect(DEVICES.rmPP.portraitHeight).toBe(1696)
  })

  it('all devices are portrait by default (height > width)', () => {
    for (const spec of Object.values(DEVICES)) {
      expect(spec.portraitHeight).toBeGreaterThan(spec.portraitWidth)
    }
  })
})

// ─── deviceBuiltins ───────────────────────────────────────────────────────────

describe('deviceBuiltins', () => {
  // ── rm2 (default) ──────────────────────────────────────────────────────────

  it('rm2 portrait has correct dimensions (default device)', () => {
    const b = deviceBuiltins('portrait')
    expect(b.templateWidth).toBe(1404)
    expect(b.templateHeight).toBe(1872)
  })

  it('rm2 landscape swaps width and height', () => {
    const b = deviceBuiltins('landscape')
    expect(b.templateWidth).toBe(1872)
    expect(b.templateHeight).toBe(1404)
  })

  it('rm2 portrait paperOriginX is negative (left of viewport)', () => {
    const b = deviceBuiltins('portrait')
    // 1404/2 - 1872/2 = -234
    expect(b.paperOriginX).toBe(-234)
  })

  it('rm2 landscape paperOriginX is positive (inset from left)', () => {
    const b = deviceBuiltins('landscape')
    // 1872/2 - 1404/2 = 234
    expect(b.paperOriginX).toBe(234)
  })

  // ── rm1 ────────────────────────────────────────────────────────────────────

  it('rm1 portrait matches rm2 (same screen resolution)', () => {
    const rm1 = deviceBuiltins('portrait', 'rm1')
    const rm2 = deviceBuiltins('portrait', 'rm2')
    expect(rm1.templateWidth).toBe(rm2.templateWidth)
    expect(rm1.templateHeight).toBe(rm2.templateHeight)
    expect(rm1.paperOriginX).toBe(rm2.paperOriginX)
  })

  // ── rmPP ───────────────────────────────────────────────────────────────────

  it('rmPP portrait: width=954, height=1696', () => {
    const b = deviceBuiltins('portrait', 'rmPP')
    expect(b.templateWidth).toBe(954)
    expect(b.templateHeight).toBe(1696)
  })

  it('rmPP landscape: width=1696, height=954', () => {
    const b = deviceBuiltins('landscape', 'rmPP')
    expect(b.templateWidth).toBe(1696)
    expect(b.templateHeight).toBe(954)
  })

  it('rmPP portrait paperOriginX = 954/2 - 1696/2 = -371', () => {
    const b = deviceBuiltins('portrait', 'rmPP')
    expect(b.paperOriginX).toBe(954 / 2 - 1696 / 2)
    expect(b.paperOriginX).toBe(-371)
  })

  it('rmPP templateWidth < mobileMaxWidth=1000 → hits mobile layout branch', () => {
    const b = deviceBuiltins('portrait', 'rmPP')
    expect(b.templateWidth).toBeLessThan(1000)
  })

  it('rmPP landscape paperOriginX = 1696/2 - 954/2 = 371', () => {
    const b = deviceBuiltins('landscape', 'rmPP')
    expect(b.paperOriginX).toBe(371)
  })

  it('throws for unknown deviceId', () => {
    expect(() => deviceBuiltins('portrait', 'rm99' as DeviceId)).toThrow()
  })

  it('portrait rm2 includes parentWidth === templateWidth and parentHeight === templateHeight', () => {
    const b = deviceBuiltins('portrait')
    expect(b.parentWidth).toBe(b.templateWidth)
    expect(b.parentHeight).toBe(b.templateHeight)
  })

  it('landscape rm2 includes parentWidth === templateWidth and parentHeight === templateHeight', () => {
    const b = deviceBuiltins('landscape')
    expect(b.parentWidth).toBe(b.templateWidth)
    expect(b.parentHeight).toBe(b.templateHeight)
  })
})

// ─── collectMissingConstants ──────────────────────────────────────────────────

describe('collectMissingConstants', () => {
  function makeTemplate(
    constants: ConstantEntry[],
    items: TemplateItem[],
  ): RemarkableTemplate {
    return {
      name: 'Test',
      author: 'Test',
      templateVersion: '1.0.0',
      formatVersion: 1,
      categories: [],
      orientation: 'portrait',
      constants,
      items,
    }
  }

  it('returns empty array when template has no items and no constants', () => {
    expect(collectMissingConstants(makeTemplate([], []))).toEqual([])
  })

  it('returns empty array when all referenced constants are defined', () => {
    const items: TemplateItem[] = [
      {
        type: 'group',
        boundingBox: { x: 'offsetX', y: 'offsetY', width: 100, height: 100 },
        children: [],
      },
    ]
    const result = collectMissingConstants(makeTemplate([{ offsetX: 0 }, { offsetY: 0 }], items))
    expect(result).toEqual([])
  })

  it('returns missing constant name when item expression references undefined key', () => {
    const items: TemplateItem[] = [
      {
        type: 'group',
        boundingBox: { x: 0, y: 'offsetY', width: 100, height: 100 },
        children: [],
      },
    ]
    const result = collectMissingConstants(makeTemplate([], items))
    expect(result).toContain('offsetY')
  })

  it('does not flag device builtins (templateWidth, templateHeight, paperOriginX, paperOriginY)', () => {
    const items: TemplateItem[] = [
      {
        type: 'group',
        boundingBox: {
          x: 'paperOriginX',
          y: 'paperOriginY',
          width: 'templateWidth',
          height: 'templateHeight',
        },
        children: [],
      },
    ]
    expect(collectMissingConstants(makeTemplate([], items))).toEqual([])
  })

  it('does not flag numeric literal ScalarValues', () => {
    const items: TemplateItem[] = [
      {
        type: 'path',
        data: ['M', 0, 100, 'L', 1404, 100],
      },
    ]
    expect(collectMissingConstants(makeTemplate([], items))).toEqual([])
  })

  it('recognises constants defined earlier in the constants array', () => {
    const items: TemplateItem[] = [
      {
        type: 'group',
        boundingBox: { x: 'derivedX', y: 0, width: 100, height: 100 },
        children: [],
      },
    ]
    // derivedX references baseX which is defined before it
    const constants: ConstantEntry[] = [{ baseX: 50 }, { derivedX: 'baseX + 10' }]
    expect(collectMissingConstants(makeTemplate(constants, items))).toEqual([])
  })

  it('flags forward references in the constants block itself', () => {
    // derivedX references notYetDefined which comes later in the array
    const constants: ConstantEntry[] = [{ derivedX: 'notYetDefined + 10' }, { notYetDefined: 50 }]
    const result = collectMissingConstants(makeTemplate(constants, []))
    expect(result).toContain('notYetDefined')
  })

  it('does not flag repeat keywords (down, infinite, up, right)', () => {
    const items: TemplateItem[] = [
      {
        type: 'group',
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        repeat: { rows: 'down', columns: 'infinite' },
        children: [],
      },
    ]
    expect(collectMissingConstants(makeTemplate([], items))).toEqual([])
  })

  it('deduplicates repeated missing identifiers', () => {
    const items: TemplateItem[] = [
      {
        type: 'group',
        boundingBox: { x: 'missing', y: 'missing', width: 100, height: 100 },
        children: [],
      },
    ]
    const result = collectMissingConstants(makeTemplate([], items))
    expect(result.filter(id => id === 'missing')).toHaveLength(1)
  })

  it('walks nested group children', () => {
    const child: TemplateItem = {
      type: 'path',
      data: ['M', 0, 'nestedConst', 'L', 100, 'nestedConst'],
    }
    const items: TemplateItem[] = [
      {
        type: 'group',
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        children: [child],
      },
    ]
    const result = collectMissingConstants(makeTemplate([], items))
    expect(result).toContain('nestedConst')
  })

  it('does not flag parentWidth or parentHeight in path data tokens', () => {
    const items: TemplateItem[] = [
      {
        type: 'path',
        data: ['M', 0, 0, 'L', 'parentWidth', 'parentHeight'],
      },
    ]
    expect(collectMissingConstants(makeTemplate([], items))).toEqual([])
  })

  it('does not flag parentWidth or parentHeight in a group boundingBox expression', () => {
    const items: TemplateItem[] = [
      {
        type: 'group',
        boundingBox: { x: 0, y: 0, width: 'parentWidth', height: 'parentHeight' },
        children: [],
      },
    ]
    expect(collectMissingConstants(makeTemplate([], items))).toEqual([])
  })

  it('does not flag parentWidth or parentHeight inside a nested group child path', () => {
    const items: TemplateItem[] = [
      {
        type: 'group',
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        children: [
          {
            type: 'path',
            data: ['M', 0, 0, 'L', 'parentWidth', 0, 'L', 'parentWidth', 'parentHeight'],
          },
        ],
      },
    ]
    expect(collectMissingConstants(makeTemplate([], items))).toEqual([])
  })
})
