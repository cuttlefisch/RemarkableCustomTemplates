/**
 * Coordinate transformation utilities for the drawing overlay.
 *
 * Note: screenToTemplate lives in the component layer (DrawingOverlay.tsx)
 * because it requires DOM types (MouseEvent, SVGSVGElement) which are not
 * available in the server tsconfig that includes src/lib/*.
 */

import type { Point } from './drawingShapes'

/**
 * Convert screen (client) coordinates to template coordinates using the
 * SVG element's current transformation matrix (CTM).
 *
 * @param event - Object with `clientX` and `clientY` screen coordinates
 * @param svgElement - The SVG element whose CTM maps screen to template space
 * @returns The corresponding point in template coordinate space
 */
export function screenToTemplate(
  event: { clientX: number; clientY: number },
  svgElement: { getScreenCTM(): { inverse(): { a: number; b: number; c: number; d: number; e: number; f: number } } | null },
): Point {
  const ctm = svgElement.getScreenCTM()
  if (!ctm) return { x: event.clientX, y: event.clientY }
  const inverse = ctm.inverse()
  return {
    x: event.clientX * inverse.a + event.clientY * inverse.c + inverse.e,
    y: event.clientX * inverse.b + event.clientY * inverse.d + inverse.f,
  }
}

/**
 * Find the closest vertex within a distance threshold (snap-to-point).
 *
 * @param point - The reference point to snap from
 * @param vertices - Candidate snap targets
 * @param threshold - Maximum distance for a snap to occur
 * @returns The closest vertex if within threshold, or `null`
 */
export function snapToVertex(point: Point, vertices: Point[], threshold: number): Point | null {
  if (vertices.length === 0) return null
  let closest: Point | null = null
  let closestDist = Infinity
  for (const v of vertices) {
    const d = distanceBetween(point, v)
    if (d < closestDist) {
      closestDist = d
      closest = v
    }
  }
  return closestDist <= threshold ? closest : null
}

/**
 * Euclidean distance between two points.
 *
 * @param a - First point
 * @param b - Second point
 * @returns The straight-line distance
 */
export function distanceBetween(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
