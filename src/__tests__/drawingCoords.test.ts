import { describe, it, expect } from 'vitest'
import { screenToTemplate, snapToVertex, distanceBetween } from '../lib/drawingCoords'
import type { Point } from '../lib/drawingShapes'

// ─── screenToTemplate ────────────────────────────────────────────────────────

describe('screenToTemplate', () => {
  function makeMockSvg(matrix: DOMMatrix) {
    return {
      getScreenCTM: () => ({
        inverse: () => matrix,
      }),
    } as unknown as SVGSVGElement
  }

  it('identity CTM returns same coordinates', () => {
    const matrix = {
      a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
    } as DOMMatrix
    const event = { clientX: 100, clientY: 200 } as MouseEvent
    const result = screenToTemplate(event, makeMockSvg(matrix))
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(200)
  })

  it('2x scale halves coordinates', () => {
    const matrix = {
      a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0,
    } as DOMMatrix
    const event = { clientX: 200, clientY: 400 } as MouseEvent
    const result = screenToTemplate(event, makeMockSvg(matrix))
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(200)
  })

  it('translation offset correct', () => {
    const matrix = {
      a: 1, b: 0, c: 0, d: 1, e: -50, f: -100,
    } as DOMMatrix
    const event = { clientX: 150, clientY: 300 } as MouseEvent
    const result = screenToTemplate(event, makeMockSvg(matrix))
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(200)
  })

  it('combined scale and translation', () => {
    // Scale 2x with offset (100, 50)
    const matrix = {
      a: 0.5, b: 0, c: 0, d: 0.5, e: -50, f: -25,
    } as DOMMatrix
    const event = { clientX: 200, clientY: 100 } as MouseEvent
    const result = screenToTemplate(event, makeMockSvg(matrix))
    // x = 200 * 0.5 + (-50) = 50
    // y = 100 * 0.5 + (-25) = 25
    expect(result.x).toBeCloseTo(50)
    expect(result.y).toBeCloseTo(25)
  })
})

// ─── snapToVertex ────────────────────────────────────────────────────────────

describe('snapToVertex', () => {
  const vertices: Point[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]

  it('snaps to vertex within threshold', () => {
    const result = snapToVertex({ x: 3, y: 4 }, vertices, 10)
    expect(result).toEqual({ x: 0, y: 0 })
  })

  it('returns null when beyond threshold', () => {
    const result = snapToVertex({ x: 50, y: 50 }, vertices, 10)
    expect(result).toBeNull()
  })

  it('snaps to the closest vertex', () => {
    const result = snapToVertex({ x: 97, y: 3 }, vertices, 10)
    expect(result).toEqual({ x: 100, y: 0 })
  })

  it('returns null for empty vertices array', () => {
    const result = snapToVertex({ x: 0, y: 0 }, [], 10)
    expect(result).toBeNull()
  })

  it('snaps exactly at threshold distance', () => {
    const result = snapToVertex({ x: 10, y: 0 }, vertices, 10)
    expect(result).toEqual({ x: 0, y: 0 })
  })
})

// ─── distanceBetween ─────────────────────────────────────────────────────────

describe('distanceBetween', () => {
  it('returns 0 for same point', () => {
    expect(distanceBetween({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
  })

  it('returns correct distance for horizontal line', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(100)
  })

  it('returns correct distance for vertical line', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 0, y: 200 })).toBe(200)
  })

  it('returns correct distance for 3-4-5 triangle', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('handles negative coordinates', () => {
    expect(distanceBetween({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5)
  })
})
