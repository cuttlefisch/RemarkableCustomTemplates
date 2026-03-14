import { describe, it, expect } from 'vitest'
import { relativeLuminanceFromHex, isHighContrastDark, extractColorConstants } from '../lib/color'

describe('relativeLuminanceFromHex', () => {
  it('black has luminance 0', () => {
    expect(relativeLuminanceFromHex('#000000')).toBe(0)
  })

  it('white has luminance 1', () => {
    expect(relativeLuminanceFromHex('#ffffff')).toBeCloseTo(1, 5)
  })

  it('mid-gray has luminance between 0 and 1', () => {
    const l = relativeLuminanceFromHex('#777777')
    expect(l).toBeGreaterThan(0)
    expect(l).toBeLessThan(1)
  })

  it('red has lower luminance than white', () => {
    expect(relativeLuminanceFromHex('#ff0000')).toBeLessThan(relativeLuminanceFromHex('#ffffff'))
  })
})

describe('isHighContrastDark', () => {
  it('black bg / white fg is high-contrast dark', () => {
    expect(isHighContrastDark('#000000', '#ffffff')).toBe(true)
  })

  it('white bg / black fg is NOT dark', () => {
    expect(isHighContrastDark('#ffffff', '#000000')).toBe(false)
  })

  it('similar grays have insufficient contrast (not dark)', () => {
    // #777777 vs #888888 — low contrast ratio
    expect(isHighContrastDark('#777777', '#888888')).toBe(false)
  })

  it('same color is not high-contrast dark', () => {
    expect(isHighContrastDark('#000000', '#000000')).toBe(false)
  })
})

describe('extractColorConstants', () => {
  it('extracts hex string values', () => {
    const result = extractColorConstants([{ foreground: '#000000' }, { spacing: 100 }])
    expect(result).toEqual({ foreground: '#000000' })
  })

  it('ignores numeric values', () => {
    const result = extractColorConstants([{ size: 42 }])
    expect(result).toEqual({})
  })

  it('ignores non-hex string values', () => {
    const result = extractColorConstants([{ expr: 'templateWidth / 2' }])
    expect(result).toEqual({})
  })

  it('extracts multiple hex constants', () => {
    const result = extractColorConstants([
      { foreground: '#000000' },
      { background: '#ffffff' },
      { spacing: 100 },
    ])
    expect(result).toEqual({ foreground: '#000000', background: '#ffffff' })
  })

  it('returns empty object for empty array', () => {
    expect(extractColorConstants([])).toEqual({})
  })
})
