/**
 * Pure shape builder functions for the drawing editor.
 *
 * Each function produces a PathItem from geometric inputs. In proportional
 * scaling mode, coordinates are wrapped in expression strings that reference
 * drawnScaleX / drawnScaleY constants for multi-device scaling.
 */

import type { PathItem, PathData, ScalarValue, ConstantEntry } from '../types/template'
import { evaluateExpression, type ResolvedConstants } from './expression'

// ─── Types ───────────────────────────────────────────────────────────────────

/** A 2D point in template coordinate space. */
export interface Point {
  x: number
  y: number
}

/** Visual properties applied to drawn shapes. */
export interface ShapeProps {
  /** Whether fill is enabled for this shape. */
  fillEnabled: boolean
  /** Fill color as a hex string (e.g. `"#ff0000"`). */
  fillColor: string
  /** Stroke color as a hex string. */
  strokeColor: string
  /** Stroke width in template pixels. */
  strokeWidth: number
}

/**
 * Controls how drawn coordinates are stored in the template.
 *
 * - `'proportional'`: Coordinates are wrapped in `drawnScaleX`/`drawnScaleY`
 *   expressions that scale relative to the base device dimensions.
 * - `'fixed'`: Coordinates are stored as literal numbers, pixel-exact for one device.
 */
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
 *
 * In fixed mode, returns the rounded number. In proportional mode, wraps in a
 * `drawnScaleX`/`drawnScaleY` expression string for multi-device scaling.
 *
 * @param value - The raw coordinate value
 * @param axis - Which axis (`'x'` or `'y'`) determines the scale constant used
 * @param scaling - The active scaling mode
 * @returns A numeric literal or expression string
 */
export function scaleCoord(value: number, axis: 'x' | 'y', scaling: ScalingMode): ScalarValue {
  const rounded = roundCoord(value)
  if (scaling.type === 'fixed') return rounded
  const scaleName = axis === 'x' ? 'drawnScaleX' : 'drawnScaleY'
  return `${scaleName} * ${rounded}`
}

/**
 * Build the `drawnScaleX`/`drawnScaleY` constant entries for proportional scaling.
 *
 * These constants are injected into a template's constants array so that
 * drawn shapes scale proportionally across different device dimensions.
 *
 * @param baseWidth - The template width of the device the shape was drawn on
 * @param baseHeight - The template height of the device the shape was drawn on
 * @returns Two constant entries for `drawnScaleX` and `drawnScaleY`
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
 *
 * @param center - Center point in template coordinates
 * @param size - Half-length of each arm of the cross
 * @param props - Visual properties (stroke color/width)
 * @param scaling - Coordinate scaling mode
 * @returns A PathItem with two perpendicular line segments
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
 * Build a small filled circle (dot) at the given center.
 * Uses buildCircleItem with forced fill for dot-grid-style points.
 */
export function buildDotItem(
  center: Point,
  size: number,
  props: ShapeProps,
  scaling: ScalingMode = { type: 'fixed' },
): PathItem {
  const radius = size * 0.4
  const dotProps: ShapeProps = {
    ...props,
    fillEnabled: true,
    fillColor: props.strokeColor,
  }
  return buildCircleItem(center, radius, dotProps, scaling)
}

/**
 * Build a small diamond (rotated square) at the given center.
 */
export function buildDiamondItem(
  center: Point,
  size: number,
  props: ShapeProps,
  scaling: ScalingMode = { type: 'fixed' },
): PathItem {
  const half = size * 0.5
  const vertices: Point[] = [
    { x: center.x, y: center.y - half },   // top
    { x: center.x + half, y: center.y },   // right
    { x: center.x, y: center.y + half },   // bottom
    { x: center.x - half, y: center.y },   // left
  ]
  return buildPolygonItem(vertices, true, props, scaling)
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

// ─── Circle (4 cubic bezier quarter-arcs) ────────────────────────────────────

/** Standard constant for approximating a circle with cubic beziers. */
const CIRCLE_K = 4 * (Math.SQRT2 - 1) / 3 // ≈ 0.5523

/**
 * Build a circle approximated by 4 cubic bezier quarter-arcs.
 * Generates M + 4×C + Z (32 data tokens + 2 commands = 34 tokens).
 */
export function buildCircleItem(
  center: Point,
  radius: number,
  props: ShapeProps,
  scaling: ScalingMode = { type: 'fixed' },
): PathItem {
  const cx = center.x
  const cy = center.y
  const r = radius
  const k = CIRCLE_K * r

  const data: PathData = [
    // Start at top of circle
    'M', scaleCoord(cx, 'x', scaling), scaleCoord(cy - r, 'y', scaling),
    // Top to right
    'C',
    scaleCoord(cx + k, 'x', scaling), scaleCoord(cy - r, 'y', scaling),
    scaleCoord(cx + r, 'x', scaling), scaleCoord(cy - k, 'y', scaling),
    scaleCoord(cx + r, 'x', scaling), scaleCoord(cy, 'y', scaling),
    // Right to bottom
    'C',
    scaleCoord(cx + r, 'x', scaling), scaleCoord(cy + k, 'y', scaling),
    scaleCoord(cx + k, 'x', scaling), scaleCoord(cy + r, 'y', scaling),
    scaleCoord(cx, 'x', scaling), scaleCoord(cy + r, 'y', scaling),
    // Bottom to left
    'C',
    scaleCoord(cx - k, 'x', scaling), scaleCoord(cy + r, 'y', scaling),
    scaleCoord(cx - r, 'x', scaling), scaleCoord(cy + k, 'y', scaling),
    scaleCoord(cx - r, 'x', scaling), scaleCoord(cy, 'y', scaling),
    // Left to top
    'C',
    scaleCoord(cx - r, 'x', scaling), scaleCoord(cy - k, 'y', scaling),
    scaleCoord(cx - k, 'x', scaling), scaleCoord(cy - r, 'y', scaling),
    scaleCoord(cx, 'x', scaling), scaleCoord(cy - r, 'y', scaling),
    'Z',
  ]
  return makePathItem(data, props, true)
}

// ─── Bezier curve ────────────────────────────────────────────────────────────

/**
 * Build a smooth bezier path from anchor points using Catmull-Rom → cubic
 * bezier conversion. For segment P[i]→P[i+1]:
 *   CP1 = P[i] + (P[i+1] - P[i-1]) / 6
 *   CP2 = P[i+1] - (P[i+2] - P[i]) / 6
 * Open path endpoints clamp indices; closed paths wrap cyclically.
 */
export function buildBezierItem(
  anchors: Point[],
  closed: boolean,
  props: ShapeProps,
  scaling: ScalingMode = { type: 'fixed' },
): PathItem {
  if (anchors.length < 2) {
    return makePathItem(['M', scaleCoord(anchors[0].x, 'x', scaling), scaleCoord(anchors[0].y, 'y', scaling)], props, true)
  }

  const n = anchors.length

  // Helper to get point by index with appropriate boundary handling
  function pt(i: number): Point {
    if (closed) {
      return anchors[((i % n) + n) % n]
    }
    return anchors[Math.max(0, Math.min(n - 1, i))]
  }

  const data: PathData = [
    'M', scaleCoord(anchors[0].x, 'x', scaling), scaleCoord(anchors[0].y, 'y', scaling),
  ]

  const segCount = closed ? n : n - 1

  for (let i = 0; i < segCount; i++) {
    const p0 = pt(i - 1)
    const p1 = pt(i)
    const p2 = pt(i + 1)
    const p3 = pt(i + 2)

    // Catmull-Rom to cubic bezier control points
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    data.push(
      'C',
      scaleCoord(cp1x, 'x', scaling), scaleCoord(cp1y, 'y', scaling),
      scaleCoord(cp2x, 'x', scaling), scaleCoord(cp2y, 'y', scaling),
      scaleCoord(p2.x, 'x', scaling), scaleCoord(p2.y, 'y', scaling),
    )
  }

  if (closed) {
    data.push('Z')
  }

  return makePathItem(data, props, true)
}

// ─── Bezier handle extraction & rebuilding ────────────────────────────────────

/** Structured representation of a cubic bezier path's knots and control points. */
export interface BezierHandles {
  /** Anchor points (knots) of the bezier path. */
  knots: Point[]
  /** Control point pairs `[cp1, cp2]` for each segment between consecutive knots. */
  controlPoints: [Point, Point][]
  /** Whether the path forms a closed loop. */
  closed: boolean
}

/**
 * Parse `M + n×C [+ Z]` PathData into structured bezier handles.
 *
 * @param data - Flat PathData token array
 * @returns Structured handles, or `null` if data contains expressions or non-bezier commands
 */
export function extractBezierHandles(data: PathData): BezierHandles | null {
  if (data.length < 3 || data[0] !== 'M') return null
  if (typeof data[1] !== 'number' || typeof data[2] !== 'number') return null

  const knots: Point[] = [{ x: data[1], y: data[2] }]
  const controlPoints: [Point, Point][] = []
  let i = 3
  let closed = false

  while (i < data.length) {
    const token = data[i]
    if (token === 'Z') {
      closed = true
      i++
      continue
    }
    if (token !== 'C') return null // not a pure bezier path (has L or other commands)

    // C requires 6 numeric values
    if (i + 6 >= data.length) return null
    for (let j = 1; j <= 6; j++) {
      if (typeof data[i + j] !== 'number') return null
    }

    const cp1: Point = { x: data[i + 1] as number, y: data[i + 2] as number }
    const cp2: Point = { x: data[i + 3] as number, y: data[i + 4] as number }
    const knot: Point = { x: data[i + 5] as number, y: data[i + 6] as number }
    controlPoints.push([cp1, cp2])
    knots.push(knot)
    i += 7
  }

  if (controlPoints.length === 0) return null

  // Deduplicate: closed paths (e.g. circles) may have the last knot identical
  // to the first. Remove it to restore the invariant: N knots ↔ N CP pairs.
  if (closed && knots.length === controlPoints.length + 1) {
    const first = knots[0]
    const last = knots[knots.length - 1]
    if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) {
      knots.pop()
    }
  }

  return { knots, controlPoints, closed }
}

/**
 * Serialize BezierHandles back to flat numeric PathData.
 *
 * @param handles - Structured bezier handles to serialize
 * @returns Flat PathData token array with numeric coordinates
 */
export function rebuildBezierPathData(handles: BezierHandles): PathData {
  const data: PathData = ['M', handles.knots[0].x, handles.knots[0].y]

  for (let i = 0; i < handles.controlPoints.length; i++) {
    const [cp1, cp2] = handles.controlPoints[i]
    const knot = handles.knots[(i + 1) % handles.knots.length]
    data.push('C', cp1.x, cp1.y, cp2.x, cp2.y, knot.x, knot.y)
  }

  if (handles.closed) data.push('Z')
  return data
}

// ─── Hobby's algorithm ────────────────────────────────────────────────────────

/**
 * Compute Hobby's spline control points from anchor points.
 *
 * Hobby's algorithm minimizes bending energy by computing "turning angles"
 * at each knot via a tridiagonal system, then converting those angles
 * to cubic bezier control points via Hobby's velocity function.
 *
 * @param anchors - Ordered knot points of the spline
 * @param closed - Whether the spline forms a closed loop
 * @returns One `{ cp1, cp2 }` control point pair per segment
 */
export function computeHobbyControlPoints(
  anchors: Point[],
  closed: boolean,
): { cp1: Point; cp2: Point }[] {
  const n = anchors.length
  if (n < 2) return []

  // Compute chord lengths and angles
  const segCount = closed ? n : n - 1
  const d: number[] = []     // chord lengths
  const psi: number[] = []   // chord angles

  for (let i = 0; i < segCount; i++) {
    const i2 = (i + 1) % n
    const dx = anchors[i2].x - anchors[i].x
    const dy = anchors[i2].y - anchors[i].y
    d.push(Math.sqrt(dx * dx + dy * dy))
    psi.push(Math.atan2(dy, dx))
  }

  // Compute turning angles (delta[i] = psi[i] - psi[i-1])
  const delta: number[] = new Array(segCount).fill(0)
  for (let i = 1; i < segCount; i++) {
    delta[i] = normalizeAngle(psi[i] - psi[i - 1])
  }
  if (closed && segCount > 0) {
    delta[0] = normalizeAngle(psi[0] - psi[segCount - 1])
  }

  // Solve for theta angles at each knot
  const theta: number[] = new Array(n).fill(0)

  if (n === 2) {
    // Degenerate: straight line, theta = 0
  } else if (!closed) {
    // Open path: solve tridiagonal with natural boundary (theta[0] = 0, theta[n-1] = 0)
    solveHobbyOpen(d, delta, theta, n, segCount)
  } else {
    // Closed path: solve cyclic tridiagonal
    solveHobbyClosed(d, delta, theta, n, segCount)
  }

  // Compute phi[i] = -theta[i+1] - delta[i+1] for each segment.
  // From C1 continuity at knot i+1: psi[i] - phi[i] = psi[i+1] + theta[i+1]
  //   → phi[i] = -(psi[i+1] - psi[i]) - theta[i+1] = -delta[i+1] - theta[i+1]
  // For the last segment of an open path, there's no next turning angle (delta = 0).
  const result: { cp1: Point; cp2: Point }[] = []

  for (let i = 0; i < segCount; i++) {
    const i2 = (i + 1) % n
    const nextDelta = closed
      ? delta[(i + 1) % segCount]
      : ((i + 1) < segCount ? delta[i + 1] : 0)
    const phi = -theta[i2] - nextDelta
    const t = theta[i]

    // Hobby's velocity function
    const alpha = hobbyAlpha(t, phi)
    const beta = hobbyAlpha(phi, t)

    const segLen = d[i]
    if (segLen < 1e-10) {
      // Degenerate segment: CPs at endpoints
      result.push({ cp1: { ...anchors[i] }, cp2: { ...anchors[i2] } })
      continue
    }

    const cp1Dist = segLen * alpha / 3
    const cp2Dist = segLen * beta / 3

    const angle1 = psi[i] + t
    const angle2 = psi[i] - phi + Math.PI

    result.push({
      cp1: {
        x: anchors[i].x + cp1Dist * Math.cos(angle1),
        y: anchors[i].y + cp1Dist * Math.sin(angle1),
      },
      cp2: {
        x: anchors[i2].x + cp2Dist * Math.cos(angle2),
        y: anchors[i2].y + cp2Dist * Math.sin(angle2),
      },
    })
  }

  return result
}

/** Normalize angle to [-PI, PI] */
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

/**
 * Hobby's velocity function.
 *
 * Returns the factor alpha such that the control arm length = `d * alpha / 3`.
 * For `theta = phi = 0` (straight line), returns `1`.
 *
 * Based on John Hobby's 1986 paper "Smooth, Easy to Compute Interpolating Splines".
 *
 * @param theta - Turning angle at the start knot of the segment
 * @param phi - Turning angle at the end knot of the segment
 * @returns The velocity factor (typically between 0.5 and 2)
 */
export function hobbyAlpha(theta: number, phi: number): number {
  const st = Math.sin(theta)
  const ct = Math.cos(theta)
  const sp = Math.sin(phi)
  const cp = Math.cos(phi)

  // Hobby's formula (1986 paper):
  //   f(theta, phi) =
  //     (2 + sqrt(2) * (sin(theta) - sin(phi)/16) * (sin(phi) - sin(theta)/16) * (cos(theta) - cos(phi)))
  //     / (1 + 0.5*(sqrt(5)-1)*cos(theta) + 0.5*(3-sqrt(5))*cos(phi))
  // Note: no factor of 3 in denominator — that's applied externally as d/3.

  const sqrt5 = Math.sqrt(5)
  const a = 0.5 * (sqrt5 - 1)  // ≈ 0.618
  const b = 0.5 * (3 - sqrt5)  // ≈ 0.382

  const num = 2 + Math.SQRT2 * (st - sp / 16) * (sp - st / 16) * (ct - cp)
  const den = 1 + a * ct + b * cp

  if (Math.abs(den) < 1e-10) return 1
  return num / den
}

/** Solve Hobby's tridiagonal system for open paths (natural boundary). */
function solveHobbyOpen(
  d: number[], delta: number[], theta: number[],
  n: number, segCount: number,
): void {
  // Interior knots: set up equations
  // At knot i (1 <= i <= n-2):
  //   (d[i-1]) * theta[i-1] + (2 * (d[i-1] + d[i])) * theta[i] + (d[i]) * theta[i+1] = -delta[i] * ...
  // Simplified: use the standard Hobby mock-curvature equations
  // For unit tension: theta[i-1]/d[i] + (2*(d[i-1]+d[i])/(d[i-1]*d[i]))*theta[i] + theta[i+1]/d[i-1] = ...

  if (n <= 2) return

  const interiorCount = n - 2
  const a: number[] = new Array(interiorCount).fill(0) // sub-diagonal
  const b: number[] = new Array(interiorCount).fill(0) // diagonal
  const c: number[] = new Array(interiorCount).fill(0) // super-diagonal
  const rhs: number[] = new Array(interiorCount).fill(0)

  for (let k = 0; k < interiorCount; k++) {
    const i = k + 1 // actual knot index
    const di = Math.max(d[i - 1], 1e-10)
    const di1 = Math.max(d[i], 1e-10)

    a[k] = 1 / di       // sub-diagonal: coefficient of theta[i-1], uses d[i-1]
    b[k] = 2 * (1 / di + 1 / di1)
    c[k] = 1 / di1      // super-diagonal: coefficient of theta[i+1], uses d[i]

    const deltaI = i < segCount ? delta[i] : 0
    const deltaI1 = (i + 1) < segCount ? delta[i + 1] : 0
    rhs[k] = -(2 * deltaI / di + deltaI1 / di1)
  }

  // Thomas algorithm (forward elimination + back substitution)
  for (let k = 1; k < interiorCount; k++) {
    const m = a[k] / b[k - 1]
    b[k] -= m * c[k - 1]
    rhs[k] -= m * rhs[k - 1]
  }

  theta[interiorCount] = rhs[interiorCount - 1] / b[interiorCount - 1]
  for (let k = interiorCount - 2; k >= 0; k--) {
    theta[k + 1] = (rhs[k] - c[k] * theta[k + 2]) / b[k]
  }
  // theta[0] = 0 and theta[n-1] = 0 (natural boundary)
}

/** Solve Hobby's tridiagonal system for closed paths. */
function solveHobbyClosed(
  d: number[], delta: number[], theta: number[],
  n: number, _segCount: number,
): void {
  // For closed paths, we have n equations for n unknowns (cyclic)
  const a: number[] = new Array(n).fill(0)
  const b: number[] = new Array(n).fill(0)
  const c: number[] = new Array(n).fill(0)
  const rhs: number[] = new Array(n).fill(0)

  for (let i = 0; i < n; i++) {
    const iPrev = (i - 1 + n) % n
    const di = Math.max(d[iPrev], 1e-10)
    const di1 = Math.max(d[i], 1e-10)

    a[i] = 1 / di       // sub-diagonal: coefficient of theta[i-1], uses d[iPrev]
    b[i] = 2 * (1 / di + 1 / di1)
    c[i] = 1 / di1      // super-diagonal: coefficient of theta[i+1], uses d[i]

    const iNext = (i + 1) % n
    rhs[i] = -(2 * delta[i] / di + delta[iNext] / di1)
  }

  // Solve cyclic tridiagonal via Sherman-Morrison
  // Decompose: A = A' + u * v^T where A' is regular tridiagonal
  const gamma = -b[0]
  b[0] -= gamma
  b[n - 1] -= a[0] * c[n - 1] / gamma

  const u: number[] = new Array(n).fill(0)
  u[0] = gamma
  u[n - 1] = c[n - 1]

  const v: number[] = new Array(n).fill(0)
  v[0] = 1
  v[n - 1] = a[0] / gamma

  // Solve A' * y = rhs
  const y = solveTridiagonal(a, b, c, rhs, n)
  // Solve A' * z = u
  const z = solveTridiagonal(a, b, c, u, n)

  // x = y - (v·y / (1 + v·z)) * z
  let vy = 0, vz = 0
  for (let i = 0; i < n; i++) {
    vy += v[i] * y[i]
    vz += v[i] * z[i]
  }
  const factor = vy / (1 + vz)
  for (let i = 0; i < n; i++) {
    theta[i] = y[i] - factor * z[i]
  }
}

/** Solve tridiagonal system using Thomas algorithm. */
function solveTridiagonal(
  a: number[], b: number[], c: number[], rhs: number[], n: number,
): number[] {
  // Work on copies
  const bb = [...b]
  const dd = [...rhs]

  for (let i = 1; i < n; i++) {
    const m = a[i] / bb[i - 1]
    bb[i] -= m * c[i - 1]
    dd[i] -= m * dd[i - 1]
  }

  const x = new Array(n).fill(0)
  x[n - 1] = dd[n - 1] / bb[n - 1]
  for (let i = n - 2; i >= 0; i--) {
    x[i] = (dd[i] - c[i] * x[i + 1]) / bb[i]
  }
  return x
}

/**
 * Build a bezier PathItem using Hobby's algorithm.
 * Same signature as buildBezierItem.
 */
export function buildBezierItemHobby(
  anchors: Point[],
  closed: boolean,
  props: ShapeProps,
  scaling: ScalingMode = { type: 'fixed' },
): PathItem {
  if (anchors.length < 2) {
    return makePathItem(['M', scaleCoord(anchors[0].x, 'x', scaling), scaleCoord(anchors[0].y, 'y', scaling)], props, true)
  }

  const cps = computeHobbyControlPoints(anchors, closed)
  const n = anchors.length

  const data: PathData = [
    'M', scaleCoord(anchors[0].x, 'x', scaling), scaleCoord(anchors[0].y, 'y', scaling),
  ]

  for (let i = 0; i < cps.length; i++) {
    const { cp1, cp2 } = cps[i]
    const endKnot = anchors[(i + 1) % n]
    data.push(
      'C',
      scaleCoord(cp1.x, 'x', scaling), scaleCoord(cp1.y, 'y', scaling),
      scaleCoord(cp2.x, 'x', scaling), scaleCoord(cp2.y, 'y', scaling),
      scaleCoord(endKnot.x, 'x', scaling), scaleCoord(endKnot.y, 'y', scaling),
    )
  }

  if (closed) data.push('Z')
  return makePathItem(data, props, true)
}

// ─── Translation ─────────────────────────────────────────────────────────────

/**
 * Translate a PathItem by `(dx, dy)`.
 *
 * @param item - The path item to translate
 * @param dx - Horizontal offset in template pixels
 * @param dy - Vertical offset in template pixels
 * @returns A new PathItem with translated coordinates, or `null` if the path
 *   contains expression strings (proportional mode) that can't be offset
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

// ─── Reordering (layering) ───────────────────────────────────────────────────

/**
 * Reorder an item in an array by direction (for z-order layering).
 *
 * @param items - The array to reorder
 * @param fromIndex - Index of the item to move
 * @param direction - `'up'`/`'down'` swap by one; `'top'`/`'bottom'` move to end/start
 * @returns A new array with the item moved, or the same reference if no change
 */
export function reorderItem<T>(items: T[], fromIndex: number, direction: 'up' | 'down' | 'top' | 'bottom'): T[] {
  if (fromIndex < 0 || fromIndex >= items.length) return items

  switch (direction) {
    case 'up': {
      if (fromIndex >= items.length - 1) return items
      const result = [...items]
      ;[result[fromIndex], result[fromIndex + 1]] = [result[fromIndex + 1], result[fromIndex]]
      return result
    }
    case 'down': {
      if (fromIndex <= 0) return items
      const result = [...items]
      ;[result[fromIndex], result[fromIndex - 1]] = [result[fromIndex - 1], result[fromIndex]]
      return result
    }
    case 'top': {
      if (fromIndex >= items.length - 1) return items
      const result = [...items]
      const [item] = result.splice(fromIndex, 1)
      result.push(item)
      return result
    }
    case 'bottom': {
      if (fromIndex <= 0) return items
      const result = [...items]
      const [item] = result.splice(fromIndex, 1)
      result.unshift(item)
      return result
    }
  }
}

// ─── Rotation ────────────────────────────────────────────────────────────────

/**
 * Rotate a point around a center by the given angle.
 *
 * @param point - The point to rotate
 * @param angleDeg - Rotation angle in degrees (positive = clockwise)
 * @param center - Center of rotation
 * @returns The rotated point, rounded to 4 decimal places
 */
export function rotatePoint(point: Point, angleDeg: number, center: Point): Point {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: roundCoord(center.x + dx * cos - dy * sin),
    y: roundCoord(center.y + dx * sin + dy * cos),
  }
}

/**
 * Rotate all coordinates in a PathData array around the given center (or centroid).
 *
 * @param data - Flat PathData token array
 * @param angleDeg - Rotation angle in degrees
 * @param center - Optional center of rotation (defaults to the path's centroid)
 * @returns A new PathData with rotated coordinates, or `null` if the path contains expression strings
 */
export function rotatePathData(data: PathData, angleDeg: number, center?: Point): PathData | null {
  // First, extract all numeric coordinate pairs to compute centroid
  const points: Point[] = []
  const commands = new Set(['M', 'L', 'C', 'Z'])

  for (let i = 0; i < data.length; i++) {
    const token = data[i]
    if (typeof token === 'string' && commands.has(token)) {
      continue
    } else if (typeof token === 'number') {
      const next = data[i + 1]
      if (typeof next === 'number') {
        points.push({ x: token, y: next })
        i++ // skip the y coordinate
      }
    } else {
      return null // expression string
    }
  }

  if (points.length === 0) return null

  // Compute centroid if no center provided
  const cx = center?.x ?? points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = center?.y ?? points.reduce((s, p) => s + p.y, 0) / points.length
  const rotCenter = { x: cx, y: cy }

  // Rotate all coordinate pairs
  const newData: PathData = []
  let coordIndex = 0

  for (let i = 0; i < data.length; i++) {
    const token = data[i]
    if (typeof token === 'string' && commands.has(token)) {
      newData.push(token)
      coordIndex = 0
    } else if (typeof token === 'number') {
      if (coordIndex % 2 === 0) {
        // x coordinate — look ahead for y
        const y = data[i + 1]
        if (typeof y !== 'number') return null
        const rotated = rotatePoint({ x: token, y }, angleDeg, rotCenter)
        newData.push(rotated.x, rotated.y)
        i++ // skip y
        coordIndex += 2
      }
    } else {
      return null
    }
  }

  return newData
}

// ─── Path bounds ─────────────────────────────────────────────────────────────

/**
 * Compute axis-aligned bounding box from numeric-only path data.
 *
 * @param data - Flat PathData token array
 * @returns The bounding box, or `null` if the path contains expression strings or has no points
 */
export function computePathBounds(data: PathData): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let hasPoints = false
  const commands = new Set(['M', 'L', 'C', 'Z'])

  for (let i = 0; i < data.length; i++) {
    const token = data[i]
    if (typeof token === 'string' && commands.has(token)) {
      if (token === 'M' || token === 'L') {
        const x = data[i + 1]
        const y = data[i + 2]
        if (typeof x !== 'number' || typeof y !== 'number') return null
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
        hasPoints = true
        i += 2
      } else if (token === 'C') {
        for (let j = 0; j < 3; j++) {
          const x = data[i + 1 + j * 2]
          const y = data[i + 2 + j * 2]
          if (typeof x !== 'number' || typeof y !== 'number') return null
          minX = Math.min(minX, x); maxX = Math.max(maxX, x)
          minY = Math.min(minY, y); maxY = Math.max(maxY, y)
          hasPoints = true
        }
        i += 6
      }
    } else if (typeof token === 'string') {
      return null
    }
  }

  return hasPoints ? { minX, minY, maxX, maxY } : null
}

// ─── Expression resolution for path data ──────────────────────────────────

/**
 * Translate a PathItem by `(dx, dy)`, resolving expression strings if needed.
 *
 * First attempts a direct translation. If the path contains expressions,
 * resolves them to numeric values and then translates.
 *
 * @param item - The path item to translate
 * @param dx - Horizontal offset
 * @param dy - Vertical offset
 * @param constants - Resolved constants for expression evaluation
 * @returns A translated PathItem, or `null` if expressions cannot be resolved
 */
export function translatePathItemResolved(
  item: PathItem, dx: number, dy: number, constants: ResolvedConstants
): PathItem | null {
  const direct = translatePathItem(item, dx, dy)
  if (direct) return direct
  const resolved = resolvePathDataNumeric(item.data, constants)
  if (!resolved) return null
  return translatePathItem({ ...item, data: resolved }, dx, dy)
}

/**
 * Rotate PathData by `angleDeg`, resolving expression strings if needed.
 *
 * First attempts a direct rotation. If the path contains expressions,
 * resolves them to numeric values and then rotates.
 *
 * @param data - Flat PathData token array
 * @param angleDeg - Rotation angle in degrees
 * @param constants - Resolved constants for expression evaluation
 * @param center - Optional center of rotation
 * @returns Rotated PathData, or `null` if expressions cannot be resolved
 */
export function rotatePathDataResolved(
  data: PathData, angleDeg: number, constants: ResolvedConstants, center?: Point
): PathData | null {
  const direct = rotatePathData(data, angleDeg, center)
  if (direct) return direct
  const resolved = resolvePathDataNumeric(data, constants)
  if (!resolved) return null
  return rotatePathData(resolved, angleDeg, center)
}

// ─── Scaling ──────────────────────────────────────────────────────────────

/**
 * Scale all coordinates in a PathData array around an origin point.
 *
 * @param data - Flat PathData token array
 * @param scaleX - Horizontal scale factor
 * @param scaleY - Vertical scale factor
 * @param origin - The fixed point around which scaling occurs
 * @returns Scaled PathData, or `null` if the path contains expression strings
 */
export function scalePathData(
  data: PathData, scaleX: number, scaleY: number, origin: Point,
): PathData | null {
  const commands = new Set(['M', 'L', 'C', 'Z'])
  const newData: PathData = []
  let coordIndex = 0

  for (let i = 0; i < data.length; i++) {
    const token = data[i]
    if (typeof token === 'string' && commands.has(token)) {
      newData.push(token)
      coordIndex = 0
    } else if (typeof token === 'number') {
      if (coordIndex % 2 === 0) {
        newData.push(roundCoord(origin.x + (token - origin.x) * scaleX))
      } else {
        newData.push(roundCoord(origin.y + (token - origin.y) * scaleY))
      }
      coordIndex++
    } else {
      return null // expression string
    }
  }
  return newData
}

/**
 * Scale PathData, resolving expression strings to numeric values if needed.
 *
 * @param data - Flat PathData token array
 * @param scaleX - Horizontal scale factor
 * @param scaleY - Vertical scale factor
 * @param origin - The fixed point around which scaling occurs
 * @param constants - Resolved constants for expression evaluation
 * @returns Scaled PathData, or `null` if expressions cannot be resolved
 */
export function scalePathDataResolved(
  data: PathData, scaleX: number, scaleY: number, origin: Point,
  constants: ResolvedConstants,
): PathData | null {
  const direct = scalePathData(data, scaleX, scaleY, origin)
  if (direct) return direct
  const resolved = resolvePathDataNumeric(data, constants)
  if (!resolved) return null
  return scalePathData(resolved, scaleX, scaleY, origin)
}

/**
 * Compute scale factors from a bounding-box handle drag.
 *
 * Corner handles enforce proportional (uniform) scaling. Edge handles lock
 * the perpendicular axis. Scale is clamped to a minimum of 0.01.
 *
 * @param handlePosition - Handle identifier: `'tl'`, `'tr'`, `'bl'`, `'br'`, `'t'`, `'b'`, `'l'`, `'r'`
 * @param anchor - The opposite corner/edge from the dragged handle
 * @param originalHandlePos - Handle position at drag start
 * @param currentPos - Current cursor position in template coordinates
 * @returns Scale factors `{ scaleX, scaleY }`
 */
export function computeScaleFactors(
  handlePosition: string,
  anchor: Point,
  originalHandlePos: Point,
  currentPos: Point,
): { scaleX: number; scaleY: number } {
  const MIN_SCALE = 0.01

  const dxOrig = originalHandlePos.x - anchor.x
  const dyOrig = originalHandlePos.y - anchor.y
  const dxCurr = currentPos.x - anchor.x
  const dyCurr = currentPos.y - anchor.y

  let rawScaleX = Math.abs(dxOrig) > 1e-6 ? dxCurr / dxOrig : 1
  let rawScaleY = Math.abs(dyOrig) > 1e-6 ? dyCurr / dyOrig : 1

  // Edge handles: lock one axis
  if (handlePosition === 't' || handlePosition === 'b') rawScaleX = 1
  if (handlePosition === 'l' || handlePosition === 'r') rawScaleY = 1

  // Corner handles: proportional (uniform scale)
  if (['tl', 'tr', 'bl', 'br'].includes(handlePosition)) {
    const absX = Math.abs(rawScaleX)
    const absY = Math.abs(rawScaleY)
    const uniform = Math.max(absX, absY)
    rawScaleX = uniform * Math.sign(rawScaleX || 1)
    rawScaleY = uniform * Math.sign(rawScaleY || 1)
  }

  // Clamp to avoid zero-scale
  if (Math.abs(rawScaleX) < MIN_SCALE) rawScaleX = MIN_SCALE * Math.sign(rawScaleX || 1)
  if (Math.abs(rawScaleY) < MIN_SCALE) rawScaleY = MIN_SCALE * Math.sign(rawScaleY || 1)

  return { scaleX: rawScaleX, scaleY: rawScaleY }
}

/**
 * Resolve all expression strings in PathData to numeric values.
 *
 * SVG commands (`M`, `L`, `C`, `Z`) and numeric tokens pass through unchanged.
 * String tokens are evaluated as expressions against the provided constants.
 *
 * @param data - Flat PathData token array (may contain expression strings)
 * @param constants - Resolved constants for expression evaluation
 * @returns Fully numeric PathData, or `null` if any expression fails to evaluate
 */
export function resolvePathDataNumeric(data: PathData, constants: ResolvedConstants): PathData | null {
  const result: PathData = []
  for (const token of data) {
    if (typeof token === 'number') {
      result.push(token)
    } else if (typeof token === 'string' && ['M', 'L', 'C', 'Z'].includes(token)) {
      result.push(token)
    } else if (typeof token === 'string') {
      try {
        const value = evaluateExpression(token, constants)
        result.push(value)
      } catch {
        return null
      }
    }
  }
  return result
}
