/**
 * TypeScript types for reMarkable .template JSON files.
 *
 * A template defines the graphical layout of a notebook page using a tree of
 * items (groups, paths, text). Values throughout may be numeric literals or
 * string expressions referencing named constants (e.g. "templateWidth / 2").
 */

/** A numeric literal or an expression string (may reference constants). */
export type ScalarValue = number | string

/** Named constants block — each entry is a single-key object. */
export type ConstantEntry = Record<string, ScalarValue>

// ─── Bounding box ────────────────────────────────────────────────────────────

export interface BoundingBox {
  x: ScalarValue
  y: ScalarValue
  width: ScalarValue
  height: ScalarValue
}

// ─── Repeat ──────────────────────────────────────────────────────────────────

/**
 * How many times a group tile is repeated along an axis:
 *   0          — no repeat (render once)
 *   N > 0      — exact count
 *   "down"     — fill downward/rightward from the tile's start position
 *   "infinite" — fill the full viewport (may start at negative tile index)
 */
export type RepeatValue = number | 'infinite' | 'down' | string

export interface RepeatConfig {
  rows?: RepeatValue
  columns?: RepeatValue
}

// ─── Path data atoms ─────────────────────────────────────────────────────────

/**
 * Path data is a flat array alternating between command strings and coordinate
 * values, matching the SVG-like format used by reMarkable:
 *   "M", x, y                   — move to (start new sub-path)
 *   "L", x, y                   — line to
 *   "C", x1, y1, x2, y2, x, y  — cubic bezier (2 control pts + endpoint)
 *   "Z"                         — close path
 */
export type PathCommand = 'M' | 'L' | 'C' | 'Z'
export type PathDataToken = PathCommand | ScalarValue
export type PathData = PathDataToken[]

// ─── Items ───────────────────────────────────────────────────────────────────

export interface TextItem {
  type: 'text'
  id?: string
  text: string
  fontSize: ScalarValue
  position: { x: ScalarValue; y: ScalarValue }
}

export interface PathItem {
  type: 'path'
  id?: string
  data: PathData
  fillColor?: string
  strokeColor?: string
  strokeWidth?: ScalarValue
  antialiasing?: string | boolean
}

export interface GroupItem {
  type: 'group'
  id?: string
  boundingBox: BoundingBox
  repeat?: RepeatConfig
  children: TemplateItem[]
}

export type TemplateItem = TextItem | PathItem | GroupItem

// ─── Root template ───────────────────────────────────────────────────────────

export interface RemarkableTemplate {
  name: string
  author: string
  templateVersion: string
  formatVersion: number
  categories: string[]
  orientation: 'portrait' | 'landscape'
  constants: ConstantEntry[]
  items: TemplateItem[]
}
