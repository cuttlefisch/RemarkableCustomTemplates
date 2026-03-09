import { describe, it, expect } from 'vitest'
import { evaluateExpression, resolveConstants } from '../lib/expression'

describe('evaluateExpression', () => {
  it('returns a number literal unchanged', () => {
    expect(evaluateExpression(42, {})).toBe(42)
  })

  it('evaluates a simple arithmetic string', () => {
    expect(evaluateExpression('10 + 5', {})).toBe(15)
  })

  it('substitutes a named constant', () => {
    expect(evaluateExpression('width / 2', { width: 1404 })).toBe(702)
  })

  it('evaluates multi-variable arithmetic', () => {
    const ctx = { yHeader: 146, weekNumberHeight: 77 }
    expect(evaluateExpression('yHeader + weekNumberHeight', ctx)).toBe(223)
  })

  it('evaluates a ternary — true branch', () => {
    const ctx = { templateWidth: 1404, mobileMaxWidth: 1000, mobileOffsetY: 75, zero: 0 }
    expect(evaluateExpression('templateWidth > mobileMaxWidth ? 0 : mobileOffsetY', ctx)).toBe(0)
  })

  it('evaluates a ternary — false branch', () => {
    const ctx = { templateWidth: 800, mobileMaxWidth: 1000, mobileOffsetY: 75 }
    expect(evaluateExpression('templateWidth > mobileMaxWidth ? 0 : mobileOffsetY', ctx)).toBe(75)
  })

  it('handles == comparison', () => {
    expect(evaluateExpression('x == 5 ? 1 : 2', { x: 5 })).toBe(1)
    expect(evaluateExpression('x == 5 ? 1 : 2', { x: 6 })).toBe(2)
  })

  it('handles != comparison', () => {
    expect(evaluateExpression('x != 0 ? x : 99', { x: 7 })).toBe(7)
    expect(evaluateExpression('x != 0 ? x : 99', { x: 0 })).toBe(99)
  })

  it('handles >= and <= comparisons', () => {
    expect(evaluateExpression('x >= 10 ? 1 : 0', { x: 10 })).toBe(1)
    expect(evaluateExpression('x <= 10 ? 1 : 0', { x: 10 })).toBe(1)
    expect(evaluateExpression('x >= 10 ? 1 : 0', { x: 9 })).toBe(0)
  })
})

describe('resolveConstants', () => {
  it('resolves a plain numeric constant', () => {
    const result = resolveConstants([{ mobileMaxWidth: 1000 }])
    expect(result.mobileMaxWidth).toBe(1000)
  })

  it('resolves constants that reference earlier constants', () => {
    const entries = [
      { yHeader: 146 },
      { weekNumberHeight: 77 },
      { yDays: 'yHeader + weekNumberHeight' },
    ]
    const result = resolveConstants(entries)
    expect(result.yDays).toBe(223)
  })

  it('resolves the full P Week 2 constant chain', () => {
    const entries = [
      { mobileMaxWidth: 1000 },
      { mobileOffsetY: '120 - 96 + 51' },
      { offsetY: 'templateWidth > mobileMaxWidth ? 0 : mobileOffsetY' },
      { yHeader: 146 },
      { weekNumberHeight: 77 },
      { dayHeaderHeight: 89 },
      { yDays: 'yHeader + weekNumberHeight' },
      { daysHeight: 'templateHeight - yDays' },
      { dayHeight: 'daysHeight / 3' },
    ]
    const builtins = { templateWidth: 1404, templateHeight: 1872 }
    const result = resolveConstants(entries, builtins)

    expect(result.mobileOffsetY).toBe(75)        // 120 - 96 + 51
    expect(result.offsetY).toBe(0)               // 1404 > 1000 → 0
    expect(result.yDays).toBe(223)               // 146 + 77
    expect(result.daysHeight).toBe(1649)         // 1872 - 223
    expect(result.dayHeight).toBeCloseTo(549.67, 1)
  })

  it('merges builtins with resolved constants', () => {
    const result = resolveConstants([{ half: 'total / 2' }], { total: 100 })
    expect(result.half).toBe(50)
    expect(result.total).toBe(100)
  })
})
