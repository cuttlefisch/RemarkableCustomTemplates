/**
 * Parser for reMarkable .template JSON files.
 *
 * Validates and normalises raw JSON into typed RemarkableTemplate objects,
 * assigning auto-generated IDs to items that lack them.
 */

import type {
  RemarkableTemplate,
  TemplateItem,
  GroupItem,
  PathItem,
  TextItem,
  ConstantEntry,
  RepeatConfig,
  RepeatValue,
} from '../types/template'

let _idCounter = 0
function nextId(prefix: string): string {
  return `${prefix}--${++_idCounter}`
}

/** Parse raw JSON (already decoded from a .template file) into a typed object. */
export function parseTemplate(raw: unknown): RemarkableTemplate {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Template must be a JSON object')
  }
  const r = raw as Record<string, unknown>

  return {
    name: requireString(r, 'name'),
    author: requireString(r, 'author'),
    templateVersion: requireString(r, 'templateVersion'),
    formatVersion: requireNumber(r, 'formatVersion'),
    categories: requireStringArray(r, 'categories'),
    orientation: parseOrientation(r),
    constants: parseConstants(r),
    items: parseItems(requireArray(r, 'items')),
  }
}

/** Serialise a typed template back to a plain object suitable for JSON.stringify. */
export function serializeTemplate(t: RemarkableTemplate): unknown {
  return t
}

// ─── Item parsing ─────────────────────────────────────────────────────────────

function parseItems(arr: unknown[]): TemplateItem[] {
  return arr.map(parseItem)
}

function parseItem(raw: unknown): TemplateItem {
  if (typeof raw !== 'object' || raw === null) throw new Error('Item must be an object')
  const r = raw as Record<string, unknown>
  const type = r['type']

  switch (type) {
    case 'group': return parseGroup(r)
    case 'path': return parsePath(r)
    case 'text': return parseText(r)
    default: throw new Error(`Unknown item type: "${String(type)}"`)
  }
}

function parseGroup(r: Record<string, unknown>): GroupItem {
  const bb = r['boundingBox'] as Record<string, unknown>
  if (typeof bb !== 'object' || bb === null) throw new Error('group missing boundingBox')

  return {
    type: 'group',
    id: typeof r['id'] === 'string' ? r['id'] : nextId('GROUP'),
    boundingBox: {
      x: scalarValue(bb['x']),
      y: scalarValue(bb['y']),
      width: scalarValue(bb['width']),
      height: scalarValue(bb['height']),
    },
    repeat: parseRepeat(r['repeat']),
    children: parseItems(requireArray(r, 'children')),
  }
}

function parseRepeat(raw: unknown): RepeatConfig {
  if (typeof raw !== 'object' || raw === null) return { rows: 0, columns: 0 }
  const r = raw as Record<string, unknown>
  return {
    rows: parseRepeatValue(r['rows']),
    columns: parseRepeatValue(r['columns']),
  }
}

function parseRepeatValue(v: unknown): RepeatValue {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return v
  return 0
}

function parsePath(r: Record<string, unknown>): PathItem {
  return {
    type: 'path',
    id: typeof r['id'] === 'string' ? r['id'] : nextId('PATH'),
    data: requireArray(r, 'data').map(token => {
      if (typeof token === 'string' || typeof token === 'number') return token
      throw new Error(`Invalid path data token: ${JSON.stringify(token)}`)
    }),
    fillColor: typeof r['fillColor'] === 'string' ? r['fillColor'] : undefined,
    strokeColor: typeof r['strokeColor'] === 'string' ? r['strokeColor'] : '#000000',
    strokeWidth: r['strokeWidth'] !== undefined ? scalarValue(r['strokeWidth']) : 1,
    antialiasing: r['antialiasing'] !== undefined ? r['antialiasing'] as string | boolean : true,
  }
}

function parseText(r: Record<string, unknown>): TextItem {
  const pos = r['position'] as Record<string, unknown>
  if (typeof pos !== 'object' || pos === null) throw new Error('text missing position')

  return {
    type: 'text',
    id: typeof r['id'] === 'string' ? r['id'] : nextId('TEXT'),
    text: typeof r['text'] === 'string' ? r['text'] : '',
    fontSize: scalarValue(r['fontSize']),
    position: { x: scalarValue(pos['x']), y: scalarValue(pos['y']) },
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

function parseConstants(r: Record<string, unknown>): ConstantEntry[] {
  const raw = r['constants']
  if (!Array.isArray(raw)) return []
  return raw.map(entry => {
    if (typeof entry !== 'object' || entry === null) throw new Error('Constant must be an object')
    const e = entry as Record<string, unknown>
    const result: ConstantEntry = {}
    for (const [k, v] of Object.entries(e)) {
      if (typeof v === 'string' || typeof v === 'number') result[k] = v
      else throw new Error(`Constant "${k}" has non-scalar value`)
    }
    return result
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireString(r: Record<string, unknown>, key: string): string {
  if (typeof r[key] !== 'string') throw new Error(`Missing or non-string field: "${key}"`)
  return r[key] as string
}

function requireNumber(r: Record<string, unknown>, key: string): number {
  if (typeof r[key] !== 'number') throw new Error(`Missing or non-number field: "${key}"`)
  return r[key] as number
}

function requireArray(r: Record<string, unknown>, key: string): unknown[] {
  if (!Array.isArray(r[key])) throw new Error(`Missing or non-array field: "${key}"`)
  return r[key] as unknown[]
}

function requireStringArray(r: Record<string, unknown>, key: string): string[] {
  const arr = requireArray(r, key)
  if (!arr.every(x => typeof x === 'string')) throw new Error(`"${key}" must be string[]`)
  return arr as string[]
}

function parseOrientation(r: Record<string, unknown>): 'portrait' | 'landscape' {
  const v = r['orientation']
  if (v === 'portrait' || v === 'landscape') return v
  throw new Error(`Invalid orientation: "${String(v)}"`)
}

function scalarValue(v: unknown): string | number {
  if (typeof v === 'string' || typeof v === 'number') return v
  throw new Error(`Expected string or number, got: ${JSON.stringify(v)}`)
}
