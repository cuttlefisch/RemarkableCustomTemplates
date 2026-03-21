import { describe, it, expect } from 'vitest'
import {
  buildPointItem,
  buildLineItem,
  buildPolygonItem,
  computeRegularPolygonVertices,
  buildRegularPolygonItem,
  translatePathItem,
  scaleCoord,
  buildScaleConstants,
} from '../lib/drawingShapes'
import type { Point, ShapeProps, ScalingMode } from '../lib/drawingShapes'

const DEFAULT_PROPS: ShapeProps = {
  fillEnabled: false,
  fillColor: '#ff0000',
  strokeColor: '#000000',
  strokeWidth: 2,
}

const FIXED: ScalingMode = { type: 'fixed' }
const PROPORTIONAL: ScalingMode = { type: 'proportional', baseWidth: 1404, baseHeight: 1872 }

// ─── buildPointItem ──────────────────────────────────────────────────────────

describe('buildPointItem', () => {
  it('generates a cross pattern at the given center', () => {
    const item = buildPointItem({ x: 100, y: 200 }, 10, DEFAULT_PROPS, FIXED)
    expect(item.type).toBe('path')
    expect(item.data).toEqual([
      'M', 90, 200, 'L', 110, 200,
      'M', 100, 190, 'L', 100, 210,
    ])
  })

  it('applies stroke properties', () => {
    const item = buildPointItem({ x: 50, y: 50 }, 5, DEFAULT_PROPS, FIXED)
    expect(item.strokeColor).toBe('#000000')
    expect(item.strokeWidth).toBe(2)
  })

  it('never has fill regardless of fillEnabled', () => {
    const props = { ...DEFAULT_PROPS, fillEnabled: true }
    const item = buildPointItem({ x: 50, y: 50 }, 5, props, FIXED)
    expect(item.fillColor).toBeUndefined()
  })

  it('generates expression strings in proportional mode', () => {
    const item = buildPointItem({ x: 702, y: 936 }, 10, DEFAULT_PROPS, PROPORTIONAL)
    expect(item.data).toEqual([
      'M', 'drawnScaleX * 692', 'drawnScaleY * 936',
      'L', 'drawnScaleX * 712', 'drawnScaleY * 936',
      'M', 'drawnScaleX * 702', 'drawnScaleY * 926',
      'L', 'drawnScaleX * 702', 'drawnScaleY * 946',
    ])
  })
})

// ─── buildLineItem ───────────────────────────────────────────────────────────

describe('buildLineItem', () => {
  it('generates M-L path for a line segment', () => {
    const item = buildLineItem({ x: 0, y: 100 }, { x: 1404, y: 100 }, DEFAULT_PROPS, FIXED)
    expect(item.data).toEqual(['M', 0, 100, 'L', 1404, 100])
  })

  it('applies stroke properties', () => {
    const item = buildLineItem({ x: 0, y: 0 }, { x: 100, y: 100 }, DEFAULT_PROPS, FIXED)
    expect(item.strokeColor).toBe('#000000')
    expect(item.strokeWidth).toBe(2)
    expect(item.fillColor).toBeUndefined()
  })

  it('generates expression strings in proportional mode', () => {
    const item = buildLineItem({ x: 100, y: 200 }, { x: 300, y: 400 }, DEFAULT_PROPS, PROPORTIONAL)
    expect(item.data).toEqual([
      'M', 'drawnScaleX * 100', 'drawnScaleY * 200',
      'L', 'drawnScaleX * 300', 'drawnScaleY * 400',
    ])
  })
})

// ─── buildPolygonItem ────────────────────────────────────────────────────────

describe('buildPolygonItem', () => {
  it('generates a closed polygon with Z', () => {
    const vertices: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const item = buildPolygonItem(vertices, true, DEFAULT_PROPS, FIXED)
    expect(item.data).toEqual([
      'M', 0, 0, 'L', 100, 0, 'L', 100, 100, 'L', 0, 100, 'Z',
    ])
  })

  it('generates an open polyline without Z', () => {
    const vertices: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    const item = buildPolygonItem(vertices, false, DEFAULT_PROPS, FIXED)
    expect(item.data).toEqual(['M', 0, 0, 'L', 100, 0, 'L', 100, 100])
  })

  it('applies fill when fillEnabled is true', () => {
    const vertices: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]
    const props = { ...DEFAULT_PROPS, fillEnabled: true }
    const item = buildPolygonItem(vertices, true, props, FIXED)
    expect(item.fillColor).toBe('#ff0000')
  })

  it('omits fill when fillEnabled is false', () => {
    const vertices: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]
    const item = buildPolygonItem(vertices, true, DEFAULT_PROPS, FIXED)
    expect(item.fillColor).toBeUndefined()
  })

  it('generates proportional expressions for all vertices', () => {
    const vertices: Point[] = [
      { x: 100, y: 200 },
      { x: 300, y: 400 },
      { x: 500, y: 600 },
    ]
    const item = buildPolygonItem(vertices, true, DEFAULT_PROPS, PROPORTIONAL)
    expect(item.data).toEqual([
      'M', 'drawnScaleX * 100', 'drawnScaleY * 200',
      'L', 'drawnScaleX * 300', 'drawnScaleY * 400',
      'L', 'drawnScaleX * 500', 'drawnScaleY * 600',
      'Z',
    ])
  })
})

// ─── computeRegularPolygonVertices ───────────────────────────────────────────

describe('computeRegularPolygonVertices', () => {
  it('triangle: 3 vertices at correct positions', () => {
    const verts = computeRegularPolygonVertices({ x: 0, y: 0 }, 100, 3)
    expect(verts).toHaveLength(3)
    // top vertex at -PI/2 → (0, -100)
    expect(verts[0].x).toBeCloseTo(0, 4)
    expect(verts[0].y).toBeCloseTo(-100, 4)
  })

  it('square: 4 vertices at 45° offsets', () => {
    const verts = computeRegularPolygonVertices({ x: 0, y: 0 }, 100, 4)
    expect(verts).toHaveLength(4)
    // Top vertex
    expect(verts[0].x).toBeCloseTo(0, 4)
    expect(verts[0].y).toBeCloseTo(-100, 4)
    // Right vertex
    expect(verts[1].x).toBeCloseTo(100, 4)
    expect(verts[1].y).toBeCloseTo(0, 4)
  })

  it('hexagon: 6 vertices', () => {
    const verts = computeRegularPolygonVertices({ x: 500, y: 500 }, 50, 6)
    expect(verts).toHaveLength(6)
    // All at distance 50 from center
    for (const v of verts) {
      const dist = Math.sqrt((v.x - 500) ** 2 + (v.y - 500) ** 2)
      expect(dist).toBeCloseTo(50, 4)
    }
  })

  it('applies center offset', () => {
    const verts = computeRegularPolygonVertices({ x: 200, y: 300 }, 100, 4)
    // Top vertex offset by center
    expect(verts[0].x).toBeCloseTo(200, 4)
    expect(verts[0].y).toBeCloseTo(200, 4) // 300 - 100
  })
})

// ─── buildRegularPolygonItem ─────────────────────────────────────────────────

describe('buildRegularPolygonItem', () => {
  it('builds a closed polygon with correct number of edges', () => {
    const item = buildRegularPolygonItem({ x: 500, y: 500 }, 100, 5, DEFAULT_PROPS, FIXED)
    // M + 4 L + Z = M, x, y, L, x, y, L, x, y, L, x, y, L, x, y, Z
    const commands = item.data.filter(t => typeof t === 'string' && ['M', 'L', 'Z'].includes(t))
    expect(commands).toEqual(['M', 'L', 'L', 'L', 'L', 'Z'])
  })

  it('applies fill and stroke', () => {
    const props: ShapeProps = { fillEnabled: true, fillColor: '#00ff00', strokeColor: '#0000ff', strokeWidth: 3 }
    const item = buildRegularPolygonItem({ x: 0, y: 0 }, 50, 6, props, FIXED)
    expect(item.fillColor).toBe('#00ff00')
    expect(item.strokeColor).toBe('#0000ff')
    expect(item.strokeWidth).toBe(3)
  })
})

// ─── scaleCoord ──────────────────────────────────────────────────────────────

describe('scaleCoord', () => {
  it('returns raw number in fixed mode', () => {
    expect(scaleCoord(702, 'x', FIXED)).toBe(702)
  })

  it('wraps in drawnScaleX expression for x in proportional mode', () => {
    expect(scaleCoord(702, 'x', PROPORTIONAL)).toBe('drawnScaleX * 702')
  })

  it('wraps in drawnScaleY expression for y in proportional mode', () => {
    expect(scaleCoord(936, 'y', PROPORTIONAL)).toBe('drawnScaleY * 936')
  })

  it('rounds coordinate to 4 decimal places', () => {
    expect(scaleCoord(100.123456789, 'x', FIXED)).toBe(100.1235)
  })

  it('rounds coordinate in proportional mode expression', () => {
    expect(scaleCoord(100.123456789, 'x', PROPORTIONAL)).toBe('drawnScaleX * 100.1235')
  })
})

// ─── translatePathItem ───────────────────────────────────────────────────────

describe('translatePathItem', () => {
  it('offsets numeric coordinates by dx/dy', () => {
    const item = buildLineItem({ x: 100, y: 200 }, { x: 300, y: 400 }, DEFAULT_PROPS, FIXED)
    const translated = translatePathItem(item, 10, 20)
    expect(translated).not.toBeNull()
    expect(translated!.data).toEqual(['M', 110, 220, 'L', 310, 420])
  })

  it('returns null when path contains expression strings', () => {
    const item = buildLineItem({ x: 100, y: 200 }, { x: 300, y: 400 }, DEFAULT_PROPS, PROPORTIONAL)
    const translated = translatePathItem(item, 10, 20)
    expect(translated).toBeNull()
  })

  it('preserves commands (M, L, Z)', () => {
    const item = buildPolygonItem(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      true,
      DEFAULT_PROPS,
      FIXED,
    )
    const translated = translatePathItem(item, 5, 5)
    expect(translated!.data).toEqual(['M', 5, 5, 'L', 105, 5, 'L', 105, 105, 'Z'])
  })
})

// ─── buildScaleConstants ─────────────────────────────────────────────────────

describe('buildScaleConstants', () => {
  it('generates correct scale constants for RM 1&2', () => {
    const constants = buildScaleConstants(1404, 1872)
    expect(constants).toEqual([
      { drawnScaleX: 'templateWidth / 1404' },
      { drawnScaleY: 'templateHeight / 1872' },
    ])
  })

  it('generates correct scale constants for Paper Pro', () => {
    const constants = buildScaleConstants(1620, 2160)
    expect(constants).toEqual([
      { drawnScaleX: 'templateWidth / 1620' },
      { drawnScaleY: 'templateHeight / 2160' },
    ])
  })

  it('generates correct scale constants for Paper Pro Move', () => {
    const constants = buildScaleConstants(954, 1696)
    expect(constants).toEqual([
      { drawnScaleX: 'templateWidth / 954' },
      { drawnScaleY: 'templateHeight / 1696' },
    ])
  })
})
