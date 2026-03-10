/**
 * Pure rendering utilities for reMarkable templates.
 *
 * No React dependency — these functions convert template data structures into
 * SVG-ready values (d strings, coordinates, tile grids) that the TemplateCanvas
 * component assembles into JSX.
 */

import type { PathData, ScalarValue, RepeatValue } from '../types/template'
import { evaluateExpression } from './expression'

export type ResolvedConstants = Record<string, number>

// ─── Device constants ─────────────────────────────────────────────────────────

export const PORTRAIT_WIDTH = 1404
export const PORTRAIT_HEIGHT = 1872
export const LANDSCAPE_WIDTH = 1872
export const LANDSCAPE_HEIGHT = 1404

export interface DeviceSpec {
  id: string
  name: string
  shortName: string
  portraitWidth: number
  portraitHeight: number
}

export const DEVICES: Record<string, DeviceSpec> = {
  rm1: {
    id: 'rm1',
    name: 'reMarkable 1',
    shortName: 'RM1',
    portraitWidth: 1404,
    portraitHeight: 1872,
  },
  rm2: {
    id: 'rm2',
    name: 'reMarkable 2',
    shortName: 'RM2',
    portraitWidth: 1404,
    portraitHeight: 1872,
  },
  rmPP: {
    id: 'rmPP',
    name: 'reMarkable Paper Pro',
    shortName: 'Paper Pro',
    portraitWidth: 954,
    portraitHeight: 1696,
  },
}

export type DeviceId = keyof typeof DEVICES

/**
 * Built-in constants provided by the reMarkable device at render time.
 *
 * paperOriginX is the x-offset that centres a square on the page:
 *   portrait:  width/2 - height/2  (negative for portrait — grid starts left of viewport)
 *   landscape: width/2 - height/2  (positive for landscape — grid is inset from the left edge)
 */
export function deviceBuiltins(
  orientation: 'portrait' | 'landscape',
  deviceId: DeviceId = 'rm2',
): ResolvedConstants {
  const spec = DEVICES[deviceId]
  const w = orientation === 'portrait' ? spec.portraitWidth : spec.portraitHeight
  const h = orientation === 'portrait' ? spec.portraitHeight : spec.portraitWidth
  return {
    templateWidth: w,
    templateHeight: h,
    paperOriginX: w / 2 - h / 2,
    paperOriginY: 0,
  }
}

// ─── Number formatting ────────────────────────────────────────────────────────

/** Format a number for SVG output — round to 4 decimal places, strip trailing zeros. */
export function formatNum(n: number): string {
  return parseFloat(n.toFixed(4)).toString()
}

// ─── Scalar resolution ────────────────────────────────────────────────────────

/** Resolve a ScalarValue (literal or expression string) to a number. */
export function resolveScalar(value: ScalarValue, constants: ResolvedConstants): number {
  return evaluateExpression(value, constants)
}

// ─── Path data → SVG d string ─────────────────────────────────────────────────

/**
 * Convert a reMarkable PathData token array to an SVG path `d` attribute string.
 *
 * Commands (M, L, C, Z) are passed through; coordinate values (numbers or
 * expression strings) are resolved against `constants` and formatted.
 */
export function pathDataToSvgD(data: PathData, constants: ResolvedConstants): string {
  const parts: string[] = []
  for (const token of data) {
    if (token === 'M' || token === 'L' || token === 'C' || token === 'Z') {
      parts.push(token)
    } else {
      parts.push(formatNum(resolveScalar(token, constants)))
    }
  }
  return parts.join(' ')
}

// ─── Text width estimation ────────────────────────────────────────────────────

/**
 * Estimate the rendered width of text.
 *
 * This is a rough approximation (0.6 × fontSize × charCount) used to resolve
 * centering expressions like "templateWidth / 2 - textWidth / 2". A proper
 * implementation would use the Canvas API or an SVG text measurement element.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  return fontSize * 0.6 * text.length
}

// ─── Tile repeat computation ──────────────────────────────────────────────────

export interface TileRange {
  /** Index of the first tile to render (may be negative for "infinite" mode). */
  start: number
  /** Total number of tiles to render. */
  count: number
}

/**
 * Compute which tile indices to render for a single axis.
 *
 * @param tileStart  The pixel position where tile 0 begins (may be negative).
 * @param tileSize   The size of each tile in pixels.
 * @param viewSize   The total viewport size along this axis (templateWidth or templateHeight).
 * @param repeat     The repeat mode: 0 = once, N = exact count, "down" = fill forward,
 *                   "infinite" = fill both directions to cover the viewport.
 */
export function computeTileRange(
  tileStart: number,
  tileSize: number,
  viewSize: number,
  repeat: RepeatValue,
): TileRange {
  if (tileSize <= 0) return { start: 0, count: 1 }

  // No repeat — render tile 0 once (still needs the translate applied)
  if (repeat === 0) return { start: 0, count: 1 }

  // Exact positive integer count
  if (typeof repeat === 'number' && repeat > 0) {
    return { start: 0, count: repeat }
  }

  // "down" — fill downward/rightward from tile 0, never before the tile's origin
  if (repeat === 'down') {
    // A tile starting exactly at viewSize has zero visible pixels — exclude it.
    const lastTile = Math.ceil((viewSize - tileStart) / tileSize) - 1
    return { start: 0, count: Math.max(1, lastTile + 1) }
  }

  // "infinite" — fill the full viewport, potentially starting before tile 0
  if (repeat === 'infinite') {
    const firstTile = Math.floor((0 - tileStart) / tileSize)
    const lastTile = Math.ceil((viewSize - tileStart) / tileSize) - 1
    return { start: firstTile, count: Math.max(1, lastTile - firstTile + 1) }
  }

  // "up" — fill upward from the anchor (tile 0), never past it going forward
  if (repeat === 'up') {
    const firstTile = Math.floor((0 - tileStart) / tileSize)
    return { start: firstTile, count: Math.max(1, 0 - firstTile + 1) }
  }

  // "right" — fill rightward/downward from tile 0 (horizontal alias for "down")
  if (repeat === 'right') {
    const lastTile = Math.ceil((viewSize - tileStart) / tileSize) - 1
    return { start: 0, count: Math.max(1, lastTile + 1) }
  }

  // Unknown string — treat as no repeat
  return { start: 0, count: 1 }
}
