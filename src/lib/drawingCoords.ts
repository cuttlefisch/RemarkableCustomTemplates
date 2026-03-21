/**
 * Coordinate transformation utilities for the drawing overlay.
 *
 * Note: screenToTemplate lives in the component layer (DrawingOverlay.tsx)
 * because it requires DOM types (MouseEvent, SVGSVGElement) which are not
 * available in the server tsconfig that includes src/lib/*.
 */

import type { Point } from './drawingShapes'

/**
 * Convert screen coordinates to template coordinates using an inverse CTM.
 * The inverseCTM should come from svgElement.getScreenCTM().inverse().
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
 * Find the closest vertex within a distance threshold.
 * Returns the vertex if within threshold, null otherwise.
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
 */
export function distanceBetween(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
