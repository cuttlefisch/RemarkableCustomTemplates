import { describe, it, expect } from 'vitest'
import {
  formatNum,
  pathDataToSvgD,
  estimateTextWidth,
  computeTileRange,
  deviceBuiltins,
  PORTRAIT_WIDTH,
  PORTRAIT_HEIGHT,
  LANDSCAPE_WIDTH,
  LANDSCAPE_HEIGHT,
} from '../lib/renderer'

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
})

// ─── deviceBuiltins ───────────────────────────────────────────────────────────

describe('deviceBuiltins', () => {
  it('portrait has correct dimensions', () => {
    const b = deviceBuiltins('portrait')
    expect(b.templateWidth).toBe(PORTRAIT_WIDTH)
    expect(b.templateHeight).toBe(PORTRAIT_HEIGHT)
    expect(b.templateWidth).toBe(1404)
    expect(b.templateHeight).toBe(1872)
  })

  it('landscape has correct dimensions', () => {
    const b = deviceBuiltins('landscape')
    expect(b.templateWidth).toBe(LANDSCAPE_WIDTH)
    expect(b.templateHeight).toBe(LANDSCAPE_HEIGHT)
    expect(b.templateWidth).toBe(1872)
    expect(b.templateHeight).toBe(1404)
  })

  it('portrait paperOriginX is negative (left of viewport)', () => {
    const b = deviceBuiltins('portrait')
    // 1404/2 - 1872/2 = -234
    expect(b.paperOriginX).toBe(-234)
  })

  it('landscape paperOriginX is positive (inset from left)', () => {
    const b = deviceBuiltins('landscape')
    // 1872/2 - 1404/2 = 234
    expect(b.paperOriginX).toBe(234)
  })
})
