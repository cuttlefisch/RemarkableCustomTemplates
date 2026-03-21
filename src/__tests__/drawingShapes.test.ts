import { describe, it, expect } from 'vitest'
import {
  buildPointItem,
  buildDotItem,
  buildDiamondItem,
  buildLineItem,
  buildPolygonItem,
  computeRegularPolygonVertices,
  buildRegularPolygonItem,
  buildCircleItem,
  buildBezierItem,
  buildBezierItemHobby,
  extractBezierHandles,
  rebuildBezierPathData,
  computeHobbyControlPoints,
  translatePathItem,
  scaleCoord,
  buildScaleConstants,
  reorderItem,
  rotatePoint,
  rotatePathData,
  computePathBounds,
  resolvePathDataNumeric,
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

// ─── buildCircleItem ────────────────────────────────────────────────────────

describe('buildCircleItem', () => {
  it('generates 4 C commands and Z', () => {
    const item = buildCircleItem({ x: 500, y: 500 }, 100, DEFAULT_PROPS, FIXED)
    const commands = item.data.filter(t => typeof t === 'string' && ['M', 'C', 'Z'].includes(t as string))
    expect(commands).toEqual(['M', 'C', 'C', 'C', 'C', 'Z'])
  })

  it('start and end point are at top of circle', () => {
    const item = buildCircleItem({ x: 500, y: 500 }, 100, DEFAULT_PROPS, FIXED)
    // M x y → should be (500, 400)
    expect(item.data[1]).toBe(500)
    expect(item.data[2]).toBe(400)
  })

  it('applies fill when enabled', () => {
    const props: ShapeProps = { fillEnabled: true, fillColor: '#ff0000', strokeColor: '#000000', strokeWidth: 2 }
    const item = buildCircleItem({ x: 0, y: 0 }, 50, props, FIXED)
    expect(item.fillColor).toBe('#ff0000')
  })

  it('proportional mode generates expressions', () => {
    const item = buildCircleItem({ x: 500, y: 500 }, 100, DEFAULT_PROPS, PROPORTIONAL)
    const hasExpressions = item.data.some(t => typeof t === 'string' && (t as string).includes('drawnScale'))
    expect(hasExpressions).toBe(true)
  })
})

// ─── buildBezierItem ────────────────────────────────────────────────────────

describe('buildBezierItem', () => {
  it('generates C commands for each segment', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    const item = buildBezierItem(anchors, false, DEFAULT_PROPS, FIXED)
    const commands = item.data.filter(t => typeof t === 'string' && ['M', 'C', 'Z'].includes(t as string))
    expect(commands).toEqual(['M', 'C', 'C'])
  })

  it('adds closing segment and Z when closed', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    const item = buildBezierItem(anchors, true, DEFAULT_PROPS, FIXED)
    const commands = item.data.filter(t => typeof t === 'string' && ['M', 'C', 'Z'].includes(t as string))
    // 3 segments (closed wraps) + Z
    expect(commands).toEqual(['M', 'C', 'C', 'C', 'Z'])
  })

  it('control points are non-collinear (actual curves, not straight lines)', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { x: 200, y: 0 },
      { x: 300, y: 50 },
    ]
    const item = buildBezierItem(anchors, false, DEFAULT_PROPS, FIXED)
    // Extract the first C command's control points (after M x y C cp1x cp1y cp2x cp2y ex ey)
    // With Catmull-Rom, CP1 for segment 0→1: P0 + (P1 - P_clamped(-1)) / 6
    // Since open path clamps P[-1] = P[0], CP1 = P0 + (P1 - P0) / 6
    // CP2 = P1 - (P2 - P0) / 6
    // For a non-trivial path, CP2 should differ from a straight-line 2/3 point
    const cp2y = item.data[7] as number
    // Straight-line CP2 would be at 2/3 of (0,0)→(100,50) = y ≈ 33.33
    // Catmull-Rom CP2 = P1 - (P2 - P0)/6 = y = 50 - 0/6 = 50
    // The y should differ from straight-line interpolation
    expect(cp2y).not.toBeCloseTo(50 * 2 / 3, 0)
  })

  it('supports proportional mode', () => {
    const anchors: Point[] = [{ x: 100, y: 200 }, { x: 300, y: 400 }]
    const item = buildBezierItem(anchors, false, DEFAULT_PROPS, PROPORTIONAL)
    const hasExpressions = item.data.some(t => typeof t === 'string' && (t as string).includes('drawnScale'))
    expect(hasExpressions).toBe(true)
  })
})

// ─── reorderItem ────────────────────────────────────────────────────────────

describe('reorderItem', () => {
  const items = ['a', 'b', 'c', 'd']

  it('moves item up (toward end)', () => {
    expect(reorderItem(items, 1, 'up')).toEqual(['a', 'c', 'b', 'd'])
  })

  it('moves item down (toward start)', () => {
    expect(reorderItem(items, 2, 'down')).toEqual(['a', 'c', 'b', 'd'])
  })

  it('moves item to top (end)', () => {
    expect(reorderItem(items, 0, 'top')).toEqual(['b', 'c', 'd', 'a'])
  })

  it('moves item to bottom (start)', () => {
    expect(reorderItem(items, 3, 'bottom')).toEqual(['d', 'a', 'b', 'c'])
  })

  it('returns same array when already at edge (up)', () => {
    expect(reorderItem(items, 3, 'up')).toBe(items)
  })

  it('returns same array when already at edge (down)', () => {
    expect(reorderItem(items, 0, 'down')).toBe(items)
  })

  it('returns same array when already at edge (top)', () => {
    expect(reorderItem(items, 3, 'top')).toBe(items)
  })

  it('returns same array when already at edge (bottom)', () => {
    expect(reorderItem(items, 0, 'bottom')).toBe(items)
  })

  it('handles out-of-range index', () => {
    expect(reorderItem(items, -1, 'up')).toBe(items)
    expect(reorderItem(items, 10, 'up')).toBe(items)
  })
})

// ─── rotatePoint ────────────────────────────────────────────────────────────

describe('rotatePoint', () => {
  it('rotates 90° clockwise', () => {
    const result = rotatePoint({ x: 1, y: 0 }, 90, { x: 0, y: 0 })
    expect(result.x).toBeCloseTo(0, 3)
    expect(result.y).toBeCloseTo(1, 3)
  })

  it('rotates 180°', () => {
    const result = rotatePoint({ x: 1, y: 0 }, 180, { x: 0, y: 0 })
    expect(result.x).toBeCloseTo(-1, 3)
    expect(result.y).toBeCloseTo(0, 3)
  })

  it('rotates 360° returns to original', () => {
    const result = rotatePoint({ x: 100, y: 50 }, 360, { x: 0, y: 0 })
    expect(result.x).toBeCloseTo(100, 3)
    expect(result.y).toBeCloseTo(50, 3)
  })

  it('rotates around custom center', () => {
    const result = rotatePoint({ x: 200, y: 100 }, 90, { x: 100, y: 100 })
    expect(result.x).toBeCloseTo(100, 3)
    expect(result.y).toBeCloseTo(200, 3)
  })
})

// ─── rotatePathData ─────────────────────────────────────────────────────────

describe('rotatePathData', () => {
  it('rotates numeric path data', () => {
    const data = ['M' as const, 100, 0, 'L' as const, 200, 0]
    const result = rotatePathData(data, 90)
    expect(result).not.toBeNull()
    // After rotation, coordinates should change
    expect(result![1]).not.toBe(100)
  })

  it('returns null for expression paths', () => {
    const data = ['M' as const, 'drawnScaleX * 100', 'drawnScaleY * 200']
    const result = rotatePathData(data, 90)
    expect(result).toBeNull()
  })

  it('360° rotation returns near-original values', () => {
    const data = ['M' as const, 100, 200, 'L' as const, 300, 400, 'Z' as const]
    const result = rotatePathData(data, 360)!
    expect(result[1]).toBeCloseTo(100, 2)
    expect(result[2]).toBeCloseTo(200, 2)
    expect(result[4]).toBeCloseTo(300, 2)
    expect(result[5]).toBeCloseTo(400, 2)
  })
})

// ─── computePathBounds ──────────────────────────────────────────────────────

describe('computePathBounds', () => {
  it('computes bounds for a rectangle', () => {
    const data = ['M' as const, 10, 20, 'L' as const, 110, 20, 'L' as const, 110, 120, 'L' as const, 10, 120, 'Z' as const]
    const bounds = computePathBounds(data)
    expect(bounds).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 120 })
  })

  it('includes C command control points', () => {
    const data = ['M' as const, 0, 0, 'C' as const, 50, -50, 100, -50, 150, 0]
    const bounds = computePathBounds(data)
    expect(bounds).not.toBeNull()
    expect(bounds!.minY).toBe(-50)
  })

  it('returns null for expression paths', () => {
    const data = ['M' as const, 'drawnScaleX * 100', 'drawnScaleY * 200']
    const bounds = computePathBounds(data)
    expect(bounds).toBeNull()
  })

  it('returns null for empty data', () => {
    const bounds = computePathBounds([])
    expect(bounds).toBeNull()
  })
})

// ─── buildDotItem ───────────────────────────────────────────────────────────

describe('buildDotItem', () => {
  it('generates a circle (M + 4×C + Z)', () => {
    const item = buildDotItem({ x: 100, y: 200 }, 10, DEFAULT_PROPS, FIXED)
    const commands = item.data.filter(t => typeof t === 'string' && ['M', 'C', 'Z'].includes(t as string))
    expect(commands).toEqual(['M', 'C', 'C', 'C', 'C', 'Z'])
  })

  it('forces fill to stroke color', () => {
    const item = buildDotItem({ x: 100, y: 200 }, 10, DEFAULT_PROPS, FIXED)
    expect(item.fillColor).toBe('#000000')
  })

  it('works in proportional mode', () => {
    const item = buildDotItem({ x: 100, y: 200 }, 10, DEFAULT_PROPS, PROPORTIONAL)
    const hasExpressions = item.data.some(t => typeof t === 'string' && (t as string).includes('drawnScale'))
    expect(hasExpressions).toBe(true)
  })
})

// ─── buildDiamondItem ───────────────────────────────────────────────────────

describe('buildDiamondItem', () => {
  it('generates a closed 4-vertex polygon', () => {
    const item = buildDiamondItem({ x: 100, y: 200 }, 10, DEFAULT_PROPS, FIXED)
    const commands = item.data.filter(t => typeof t === 'string' && ['M', 'L', 'Z'].includes(t as string))
    expect(commands).toEqual(['M', 'L', 'L', 'L', 'Z'])
  })

  it('vertices are at cardinal directions from center', () => {
    const item = buildDiamondItem({ x: 100, y: 200 }, 10, DEFAULT_PROPS, FIXED)
    // Top vertex: M 100, 195
    expect(item.data[1]).toBe(100)
    expect(item.data[2]).toBe(195)
    // Right vertex: L 105, 200
    expect(item.data[4]).toBe(105)
    expect(item.data[5]).toBe(200)
  })

  it('works in proportional mode', () => {
    const item = buildDiamondItem({ x: 100, y: 200 }, 10, DEFAULT_PROPS, PROPORTIONAL)
    const hasExpressions = item.data.some(t => typeof t === 'string' && (t as string).includes('drawnScale'))
    expect(hasExpressions).toBe(true)
  })
})

// ─── resolvePathDataNumeric ────────────────────────────────────────────────

describe('resolvePathDataNumeric', () => {
  it('passes through already-numeric data', () => {
    const data = ['M' as const, 100, 200, 'L' as const, 300, 400]
    const result = resolvePathDataNumeric(data, {})
    expect(result).toEqual(data)
  })

  it('resolves expression strings', () => {
    const data = ['M' as const, 'drawnScaleX * 100', 'drawnScaleY * 200']
    const constants = { drawnScaleX: 1.5, drawnScaleY: 2.0 }
    const result = resolvePathDataNumeric(data, constants)
    expect(result).toEqual(['M', 150, 400])
  })

  it('handles mixed numeric and expression data', () => {
    const data = ['M' as const, 100, 'drawnScaleY * 200', 'L' as const, 'drawnScaleX * 300', 400]
    const constants = { drawnScaleX: 1.0, drawnScaleY: 1.0 }
    const result = resolvePathDataNumeric(data, constants)
    expect(result).toEqual(['M', 100, 200, 'L', 300, 400])
  })

  it('returns null for unresolvable expressions', () => {
    const data = ['M' as const, 'unknownVar * 100', 200]
    const result = resolvePathDataNumeric(data, {})
    expect(result).toBeNull()
  })
})

// ─── extractBezierHandles ──────────────────────────────────────────────────

describe('extractBezierHandles', () => {
  it('extracts from open bezier path (3 knots, 2 segments)', () => {
    const item = buildBezierItem(
      [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 0 }],
      false, DEFAULT_PROPS, FIXED,
    )
    const handles = extractBezierHandles(item.data)
    expect(handles).not.toBeNull()
    expect(handles!.knots).toHaveLength(3)
    expect(handles!.controlPoints).toHaveLength(2)
    expect(handles!.closed).toBe(false)
    // Verify knot positions
    expect(handles!.knots[0]).toEqual({ x: 0, y: 0 })
    expect(handles!.knots[2].x).toBeCloseTo(200, 2)
    expect(handles!.knots[2].y).toBeCloseTo(0, 2)
  })

  it('extracts from closed bezier path (3 knots, 3 segments + Z)', () => {
    const item = buildBezierItem(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }],
      true, DEFAULT_PROPS, FIXED,
    )
    const handles = extractBezierHandles(item.data)
    expect(handles).not.toBeNull()
    expect(handles!.knots).toHaveLength(4) // 3 segments = 4 knots (last wraps to first)
    expect(handles!.controlPoints).toHaveLength(3)
    expect(handles!.closed).toBe(true)
  })

  it('returns null for polygon PathData (has L commands)', () => {
    const item = buildPolygonItem(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      true, DEFAULT_PROPS, FIXED,
    )
    expect(extractBezierHandles(item.data)).toBeNull()
  })

  it('returns null for expression-valued PathData', () => {
    const item = buildBezierItem(
      [{ x: 0, y: 0 }, { x: 100, y: 50 }],
      false, DEFAULT_PROPS, PROPORTIONAL,
    )
    expect(extractBezierHandles(item.data)).toBeNull()
  })

  it('returns null for empty or non-M-starting data', () => {
    expect(extractBezierHandles([])).toBeNull()
    expect(extractBezierHandles(['L' as const, 0, 0])).toBeNull()
  })
})

// ─── rebuildBezierPathData ────────────────────────────────────────────────

describe('rebuildBezierPathData', () => {
  it('round-trips: extract then rebuild produces equivalent data', () => {
    const item = buildBezierItem(
      [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 0 }],
      false, DEFAULT_PROPS, FIXED,
    )
    const handles = extractBezierHandles(item.data)!
    const rebuilt = rebuildBezierPathData(handles)
    // Compare numerically (roundCoord may introduce tiny differences)
    expect(rebuilt.length).toBe(item.data.length)
    for (let i = 0; i < rebuilt.length; i++) {
      if (typeof rebuilt[i] === 'number') {
        expect(rebuilt[i]).toBeCloseTo(item.data[i] as number, 4)
      } else {
        expect(rebuilt[i]).toBe(item.data[i])
      }
    }
  })

  it('closed path round-trip includes Z', () => {
    const item = buildBezierItem(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }],
      true, DEFAULT_PROPS, FIXED,
    )
    const handles = extractBezierHandles(item.data)!
    const rebuilt = rebuildBezierPathData(handles)
    expect(rebuilt[rebuilt.length - 1]).toBe('Z')
  })
})

// ─── computeHobbyControlPoints ──────────────────────────────────────────────

describe('computeHobbyControlPoints', () => {
  it('2 points: CPs along the chord', () => {
    const cps = computeHobbyControlPoints(
      [{ x: 0, y: 0 }, { x: 300, y: 0 }], false,
    )
    expect(cps).toHaveLength(1)
    // CP1 should be near 1/3 of chord, CP2 near 2/3
    expect(cps[0].cp1.x).toBeGreaterThan(0)
    expect(cps[0].cp1.x).toBeLessThan(150)
    expect(cps[0].cp2.x).toBeGreaterThan(150)
    expect(cps[0].cp2.x).toBeLessThan(300)
    // Y should be 0 for a horizontal line
    expect(cps[0].cp1.y).toBeCloseTo(0, 2)
    expect(cps[0].cp2.y).toBeCloseTo(0, 2)
  })

  it('3 collinear points: nearly-straight segments', () => {
    const cps = computeHobbyControlPoints(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], false,
    )
    expect(cps).toHaveLength(2)
    // All CPs should have y ≈ 0
    for (const { cp1, cp2 } of cps) {
      expect(cp1.y).toBeCloseTo(0, 1)
      expect(cp2.y).toBeCloseTo(0, 1)
    }
  })

  it('equilateral triangle (closed): symmetric CPs', () => {
    const h = Math.sqrt(3) / 2 * 100
    const anchors: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: h },
    ]
    const cps = computeHobbyControlPoints(anchors, true)
    expect(cps).toHaveLength(3)
    // All segments should have similar CP distances from their knots
    const dists = cps.map(({ cp1 }, i) => {
      const knot = anchors[i]
      return Math.sqrt((cp1.x - knot.x) ** 2 + (cp1.y - knot.y) ** 2)
    })
    expect(dists[0]).toBeCloseTo(dists[1], 0)
    expect(dists[1]).toBeCloseTo(dists[2], 0)
  })
})

// ─── buildBezierItemHobby ──────────────────────────────────────────────────

describe('buildBezierItemHobby', () => {
  it('produces valid M+C structure', () => {
    const item = buildBezierItemHobby(
      [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 0 }],
      false, DEFAULT_PROPS, FIXED,
    )
    const commands = item.data.filter(t => typeof t === 'string' && ['M', 'C', 'Z'].includes(t as string))
    expect(commands).toEqual(['M', 'C', 'C'])
  })

  it('closed path produces M+C*+Z', () => {
    const item = buildBezierItemHobby(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }],
      true, DEFAULT_PROPS, FIXED,
    )
    const commands = item.data.filter(t => typeof t === 'string' && ['M', 'C', 'Z'].includes(t as string))
    expect(commands).toEqual(['M', 'C', 'C', 'C', 'Z'])
  })

  it('proportional mode wraps coords in expressions', () => {
    const item = buildBezierItemHobby(
      [{ x: 100, y: 200 }, { x: 300, y: 400 }],
      false, DEFAULT_PROPS, PROPORTIONAL,
    )
    const hasExpressions = item.data.some(t => typeof t === 'string' && (t as string).includes('drawnScale'))
    expect(hasExpressions).toBe(true)
  })

  it('produces different CPs than Catmull-Rom for non-trivial paths', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 }, { x: 100, y: 80 }, { x: 200, y: 20 }, { x: 300, y: 100 },
    ]
    const catmull = buildBezierItem(anchors, false, DEFAULT_PROPS, FIXED)
    const hobby = buildBezierItemHobby(anchors, false, DEFAULT_PROPS, FIXED)
    // Same number of tokens
    expect(hobby.data.length).toBe(catmull.data.length)
    // But at least some numeric values differ (control points)
    let diffCount = 0
    for (let i = 0; i < hobby.data.length; i++) {
      if (typeof hobby.data[i] === 'number' && typeof catmull.data[i] === 'number') {
        if (Math.abs((hobby.data[i] as number) - (catmull.data[i] as number)) > 0.1) {
          diffCount++
        }
      }
    }
    expect(diffCount).toBeGreaterThan(0)
  })
})
