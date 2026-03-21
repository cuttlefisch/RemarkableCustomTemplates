/**
 * Pure shape builder functions for the drawing editor.
 *
 * Each function produces a PathItem from geometric inputs. In proportional
 * scaling mode, coordinates are wrapped in expression strings that reference
 * drawnScaleX / drawnScaleY constants for multi-device scaling.
 */

import type { PathItem, PathData, ScalarValue, ConstantEntry } from '../types/template'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Point {
  x: number
  y: number
}

export interface ShapeProps {
  fillEnabled: boolean
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

export type ScalingMode =
  | { type: 'proportional'; baseWidth: number; baseHeight: number }
  | { type: 'fixed' }

// ─── Coordinate scaling ──────────────────────────────────────────────────────

/** Round a number to 4 decimal places, stripping trailing zeros. */
function roundCoord(value: number): number {
  return parseFloat(value.toFixed(4))
}

/**
 * Scale a coordinate value for the given axis and scaling mode.
 * In fixed mode, returns the rounded number.
 * In proportional mode, wraps in a drawnScaleX/Y expression string.
 */
export function scaleCoord(value: number, axis: 'x' | 'y', scaling: ScalingMode): ScalarValue {
  const rounded = roundCoord(value)
  if (scaling.type === 'fixed') return rounded
  const scaleName = axis === 'x' ? 'drawnScaleX' : 'drawnScaleY'
  return `${scaleName} * ${rounded}`
}

/**
 * Build the scale constant entries to inject into a template's constants array.
 */
export function buildScaleConstants(baseWidth: number, baseHeight: number): ConstantEntry[] {
  return [
    { drawnScaleX: `templateWidth / ${baseWidth}` },
    { drawnScaleY: `templateHeight / ${baseHeight}` },
  ]
}

// ─── Shape builders ──────────────────────────────────────────────────────────

function makePathItem(data: PathData, props: ShapeProps, allowFill: boolean): PathItem {
  return {
    type: 'path',
    data,
    fillColor: allowFill && props.fillEnabled ? props.fillColor : undefined,
    strokeColor: props.strokeColor,
    strokeWidth: props.strokeWidth,
  }
}

/**
 * Build a cross-shaped point marker at the given center.
 */
export function buildPointItem(
  center: Point,
  size: number,
  props: ShapeProps,
  scaling: ScalingMode = { type: 'fixed' },
): PathItem {
  const data: PathData = [
    'M', scaleCoord(center.x - size, 'x', scaling), scaleCoord(center.y, 'y', scaling),
    'L', scaleCoord(center.x + size, 'x', scaling), scaleCoord(center.y, 'y', scaling),
    'M', scaleCoord(center.x, 'x', scaling), scaleCoord(center.y - size, 'y', scaling),
    'L', scaleCoord(center.x, 'x', scaling), scaleCoord(center.y + size, 'y', scaling),
  ]
  // Points never have fill
  return makePathItem(data, props, false)
}

/**
 * Build a line segment from start to end.
 */
export function buildLineItem(
  start: Point,
  end: Point,
  props: ShapeProps,
  scaling: ScalingMode = { type: 'fixed' },
): PathItem {
  const data: PathData = [
    'M', scaleCoord(start.x, 'x', scaling), scaleCoord(start.y, 'y', scaling),
    'L', scaleCoord(end.x, 'x', scaling), scaleCoord(end.y, 'y', scaling),
  ]
  // Lines never have fill
  return makePathItem(data, props, false)
}

/**
 * Build a polygon (or open polyline) from a list of vertices.
 */
export function buildPolygonItem(
  vertices: Point[],
  closed: boolean,
  props: ShapeProps,
  scaling: ScalingMode = { type: 'fixed' },
): PathItem {
  const data: PathData = []
  for (let i = 0; i < vertices.length; i++) {
    const cmd = i === 0 ? 'M' : 'L'
    data.push(cmd, scaleCoord(vertices[i].x, 'x', scaling), scaleCoord(vertices[i].y, 'y', scaling))
  }
  if (closed) data.push('Z')
  return makePathItem(data, props, true)
}

/**
 * Compute vertices of a regular polygon. First vertex is at the top (-PI/2).
 */
export function computeRegularPolygonVertices(center: Point, radius: number, sides: number): Point[] {
  const vertices: Point[] = []
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / sides
    vertices.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    })
  }
  return vertices
}

/**
 * Build a regular polygon with the given number of sides.
 */
export function buildRegularPolygonItem(
  center: Point,
  radius: number,
  sides: number,
  props: ShapeProps,
  scaling: ScalingMode = { type: 'fixed' },
): PathItem {
  const vertices = computeRegularPolygonVertices(center, radius, sides)
  return buildPolygonItem(vertices, true, props, scaling)
}

/**
 * Translate a PathItem by (dx, dy). Returns null if the path contains
 * expression strings (proportional mode) since those can't be simply offset.
 */
export function translatePathItem(item: PathItem, dx: number, dy: number): PathItem | null {
  const commands = new Set(['M', 'L', 'C', 'Z'])
  const newData: PathData = []
  let coordIndex = 0 // tracks position within a command's coordinate pairs

  for (let i = 0; i < item.data.length; i++) {
    const token = item.data[i]
    if (typeof token === 'string' && commands.has(token)) {
      newData.push(token)
      coordIndex = 0
    } else if (typeof token === 'number') {
      // Even index = x, odd index = y within each coordinate pair
      const offset = coordIndex % 2 === 0 ? dx : dy
      newData.push(roundCoord(token + offset))
      coordIndex++
    } else {
      // Expression string — can't translate
      return null
    }
  }
  return { ...item, data: newData }
}
