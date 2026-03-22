/**
 * Pure viewport math for zoom/pan in the drawing editor.
 *
 * All functions manipulate SVG viewBox parameters — no CSS transforms needed.
 * This keeps getScreenCTM() correct automatically.
 */

export interface Point {
  x: number
  y: number
}

export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 10

/**
 * Compute the SVG viewBox from template dimensions, zoom level, and pan offset.
 */
export function computeViewBox(
  templateWidth: number,
  templateHeight: number,
  zoom: number,
  pan: Point,
): ViewBox {
  const w = templateWidth / zoom
  const h = templateHeight / zoom
  const x = (templateWidth - w) / 2 - pan.x
  const y = (templateHeight - h) / 2 - pan.y
  return { x, y, w, h }
}

/**
 * Zoom centered on a cursor point in template coordinates.
 * Returns new zoom and pan values.
 */
export function zoomAtPoint(
  currentZoom: number,
  currentPan: Point,
  delta: number,
  cursorPt: Point,
  templateWidth: number,
  templateHeight: number,
): { zoom: number; pan: Point } {
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta * currentZoom))

  // Adjust pan so the cursor point stays fixed on screen
  const oldW = templateWidth / currentZoom
  const newW = templateWidth / newZoom
  const oldH = templateHeight / currentZoom
  const newH = templateHeight / newZoom

  // Fraction of cursor position within the old viewBox
  const oldVbX = (templateWidth - oldW) / 2 - currentPan.x
  const oldVbY = (templateHeight - oldH) / 2 - currentPan.y
  const fracX = (cursorPt.x - oldVbX) / oldW
  const fracY = (cursorPt.y - oldVbY) / oldH

  // New viewBox origin to keep cursor at same fraction
  const newVbX = cursorPt.x - fracX * newW
  const newVbY = cursorPt.y - fracY * newH

  const newPanX = (templateWidth - newW) / 2 - newVbX
  const newPanY = (templateHeight - newH) / 2 - newVbY

  const pan = clampPan({ x: newPanX, y: newPanY }, newZoom, templateWidth, templateHeight)
  return { zoom: newZoom, pan }
}

/**
 * Clamp pan so the viewBox doesn't drift too far outside the template.
 * Allows up to 50% overflow in each direction.
 */
export function clampPan(
  pan: Point,
  zoom: number,
  templateWidth: number,
  templateHeight: number,
): Point {
  const vw = templateWidth / zoom
  const vh = templateHeight / zoom
  const maxPanX = vw * 0.5
  const maxPanY = vh * 0.5
  return {
    x: Math.max(-maxPanX, Math.min(maxPanX, pan.x)),
    y: Math.max(-maxPanY, Math.min(maxPanY, pan.y)),
  }
}
