/**
 * Utilities for creating and managing user-defined custom templates.
 *
 * Provides: color inversion, color reference resolution, name validation/slugification,
 * default template scaffolding, and registry merging.
 */

import type { TemplateRegistry, TemplateRegistryEntry } from '../types/registry'
import type { ConstantEntry, GroupItem } from '../types/template'
import { evaluateExpression } from './expression'
import type { ResolvedConstants } from './expression'
import { deviceBuiltins } from './renderer'

export const DARK_BG_COLOR  = '#000000'
export const LIGHT_BG_COLOR = '#ffffff'

export const FOREGROUND_CONST = 'foreground'
export const BACKGROUND_CONST = 'background'

/** Full-page filled rectangle used as background, identified by id "bg".
 *  fillColor/strokeColor reference the 'background' constant by name so the
 *  device resolves the color dynamically from the constants table. */
export function buildBackgroundItem(): GroupItem {
  return {
    id: 'bg',
    type: 'group',
    boundingBox: { x: 0, y: 0, width: 'templateWidth', height: 'templateHeight' },
    repeat: { rows: 'infinite', columns: 'infinite' },
    children: [{
      type: 'path',
      strokeColor: BACKGROUND_CONST,
      fillColor: BACKGROUND_CONST,
      antialiasing: false,
      data: ['M', 0, 0, 'L', 'parentWidth', 0, 'L', 'parentWidth', 'parentHeight', 'L', 0, 'parentHeight', 'Z'],
    }],
  }
}

// ─── Color constant helpers ───────────────────────────────────────────────────

function findColorConstantValue(constants: ConstantEntry[], key: string): string | undefined {
  for (const entry of constants) {
    if (key in entry) {
      const v = entry[key]
      if (typeof v === 'string' && v.startsWith('#')) return v
    }
  }
  return undefined
}

function upsertColorConstant(constants: ConstantEntry[], key: string, value: string): ConstantEntry[] {
  const idx = constants.findIndex(e => key in e)
  if (idx >= 0) {
    return constants.map((e, i) => i === idx ? { [key]: value } : e)
  }
  return [{ [key]: value }, ...constants]
}

// ─── Invert colors ────────────────────────────────────────────────────────────

/**
 * Swaps foreground ↔ background constant values.
 * Defaults to light-mode values (fg=#000000, bg=#ffffff) when constants are absent.
 * Does not touch items or categories.
 */
export function invertColors(json: string): string {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const constants = Array.isArray(parsed.constants) ? (parsed.constants as ConstantEntry[]) : []

  const fgCurrent = findColorConstantValue(constants, FOREGROUND_CONST) ?? DARK_BG_COLOR
  const bgCurrent = findColorConstantValue(constants, BACKGROUND_CONST) ?? LIGHT_BG_COLOR

  const newConstants = upsertColorConstant(
    upsertColorConstant(constants, FOREGROUND_CONST, bgCurrent),
    BACKGROUND_CONST, fgCurrent,
  )

  return JSON.stringify({ ...parsed, constants: newConstants }, null, 2)
}

// ─── Resolve string constants ─────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Resolves and strips non-scalar constants at device-export time.
 *
 * A constant is scalar if its value is a number or a string expression that
 * evaluates to a number (e.g. 'templateWidth / 2'). Non-scalar constants
 * (hex colors, arbitrary text) are inlined into item fields and removed from
 * the constants array so the output is device-safe.
 *
 * Inlining rules:
 * - fillColor / strokeColor — exact name lookup
 * - TextItem.text — exact name lookup
 * - ScalarValue expression strings (data tokens, boundingBox, repeat, etc.) — word-boundary substitution
 */
export function resolveStringConstants(json: string): string {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const constants = Array.isArray(parsed.constants) ? (parsed.constants as ConstantEntry[]) : []
  const orientation = (parsed.orientation as 'portrait' | 'landscape') ?? 'portrait'

  // Build evaluation context and classify each constant
  const ctx: ResolvedConstants = deviceBuiltins(orientation)
  const nonScalarMap: Record<string, string> = {}
  const keptConstants: ConstantEntry[] = []

  for (const entry of constants) {
    for (const [k, v] of Object.entries(entry)) {
      if (typeof v === 'number') {
        ctx[k] = v
        keptConstants.push(entry)
      } else if (typeof v === 'string' && v.startsWith('#')) {
        nonScalarMap[k] = v
      } else if (typeof v === 'string') {
        try {
          ctx[k] = evaluateExpression(v, ctx)
          keptConstants.push(entry)
        } catch {
          nonScalarMap[k] = v
        }
      }
    }
  }

  function wordBoundarySub(value: string): string {
    let result = value
    for (const [name, replacement] of Object.entries(nonScalarMap)) {
      result = result.replace(
        new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g'),
        `(${replacement})`,
      )
    }
    return result
  }

  function resolveItem(item: unknown): unknown {
    if (typeof item !== 'object' || item === null) return item
    const obj = item as Record<string, unknown>
    const result = { ...obj }

    // Exact match for color fields
    if (typeof result.fillColor === 'string' && result.fillColor in nonScalarMap) {
      result.fillColor = nonScalarMap[result.fillColor]
    }
    if (typeof result.strokeColor === 'string' && result.strokeColor in nonScalarMap) {
      result.strokeColor = nonScalarMap[result.strokeColor]
    }
    // Exact match for TextItem text
    if (typeof result.text === 'string' && result.text in nonScalarMap) {
      result.text = nonScalarMap[result.text]
    }

    // Word-boundary substitution for ScalarValue expression strings
    if (Array.isArray(result.data)) {
      result.data = (result.data as unknown[]).map(token =>
        typeof token === 'string' ? wordBoundarySub(token) : token,
      )
    }
    for (const key of ['x', 'y', 'fontSize', 'strokeWidth'] as const) {
      if (typeof result[key] === 'string') {
        result[key] = wordBoundarySub(result[key] as string)
      }
    }
    if (typeof result.boundingBox === 'object' && result.boundingBox !== null) {
      const bb = { ...(result.boundingBox as Record<string, unknown>) }
      for (const k of ['x', 'y', 'width', 'height']) {
        if (typeof bb[k] === 'string') bb[k] = wordBoundarySub(bb[k] as string)
      }
      result.boundingBox = bb
    }
    if (typeof result.repeat === 'object' && result.repeat !== null) {
      const rep = { ...(result.repeat as Record<string, unknown>) }
      for (const k of ['rows', 'columns']) {
        if (typeof rep[k] === 'string') rep[k] = wordBoundarySub(rep[k] as string)
      }
      result.repeat = rep
    }

    if (Array.isArray(result.children)) {
      result.children = result.children.map(resolveItem)
    }
    return result
  }

  const items = Array.isArray(parsed.items) ? parsed.items : []
  const resolvedItems = items.map(resolveItem)

  return JSON.stringify({ ...parsed, constants: keptConstants, items: resolvedItems }, null, 2)
}

// ─── Color constant injection ─────────────────────────────────────────────────

/**
 * If foreground or background constants are absent, append them with light-mode
 * defaults (fg=#000000, bg=#ffffff). Also injects the bg item if absent.
 * Idempotent. Used in the save-as-new flow.
 */
export function injectColorConstants(json: string): string {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const constants = Array.isArray(parsed.constants) ? (parsed.constants as ConstantEntry[]) : []
  const items = Array.isArray(parsed.items) ? (parsed.items as unknown[]) : []

  const hasFg = constants.some(e => FOREGROUND_CONST in e)
  const hasBg = constants.some(e => BACKGROUND_CONST in e)
  const hasBgItem = items.some((item: unknown) =>
    typeof item === 'object' && item !== null && (item as Record<string, unknown>).id === 'bg',
  )

  if (hasFg && hasBg && hasBgItem) return json

  const toAdd: ConstantEntry[] = []
  if (!hasFg) toAdd.push({ [FOREGROUND_CONST]: DARK_BG_COLOR })
  if (!hasBg) toAdd.push({ [BACKGROUND_CONST]: LIGHT_BG_COLOR })

  const newItems = hasBgItem ? items : [buildBackgroundItem(), ...items]

  return JSON.stringify({ ...parsed, constants: [...constants, ...toAdd], items: newItems }, null, 2)
}

/**
 * Replaces #000000 strokeColor/fillColor values with the 'foreground' sentinel
 * throughout the item tree (recursively). Applied when forking official templates
 * so color inversion works out of the box.
 */
export function mapForegroundColors(json: string): string {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const items = Array.isArray(parsed.items) ? (parsed.items as unknown[]) : []

  function mapItem(item: unknown): unknown {
    if (typeof item !== 'object' || item === null) return item
    const result = { ...(item as Record<string, unknown>) }
    if (result.strokeColor === '#000000') result.strokeColor = FOREGROUND_CONST
    if (result.fillColor === '#000000') result.fillColor = FOREGROUND_CONST
    if (Array.isArray(result.children)) {
      result.children = result.children.map(mapItem)
    }
    return result
  }

  return JSON.stringify({ ...parsed, items: items.map(mapItem) }, null, 2)
}

/**
 * Ensures the bg item's fillColor/strokeColor reference the 'background' constant
 * by name rather than a hardcoded hex. No-op if bg item is absent.
 * Handles migration of templates that stored resolved hex values.
 */
export function syncBgItemColor(json: string): string {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const items = Array.isArray(parsed.items) ? (parsed.items as unknown[]) : []

  const hasBgItem = items.some((item: unknown) =>
    typeof item === 'object' && item !== null && (item as Record<string, unknown>).id === 'bg',
  )
  if (!hasBgItem) return json

  const newItems = items.map((item: unknown) =>
    typeof item === 'object' && item !== null && (item as Record<string, unknown>).id === 'bg'
      ? buildBackgroundItem()
      : item,
  )

  return JSON.stringify({ ...parsed, items: newItems }, null, 2)
}

// ─── Name helpers ─────────────────────────────────────────────────────────────

/** "My Grid 2" → "my-grid-2" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

/** Returns error message, or null if valid. */
export function validateCustomName(name: string, existingNames: string[]): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name cannot be empty'
  if (trimmed.length > 64) return 'Name must be 64 characters or fewer'
  if (!slugify(trimmed)) return 'Name must contain at least one letter or number'

  const lower = trimmed.toLowerCase()
  const duplicate = existingNames.some(n => n.toLowerCase() === lower)
  if (duplicate) return `A template named "${trimmed}" already exists`

  return null
}

/** Build a registry entry for a new custom template. */
export function buildCustomEntry(
  name: string,
  landscape: boolean,
  categories: string[] = ['Custom'],
  iconCode = '\ue9d8',
): TemplateRegistryEntry {
  const prefix = landscape ? 'LS' : 'P'
  return {
    name,
    filename: `custom/${prefix} ${name}`,
    iconCode,
    landscape,
    categories,
    isCustom: true,
  }
}

/** Build a starter template JSON string for a brand-new custom template. */
export function buildDefaultTemplate(name: string, landscape: boolean): string {
  const template = {
    name,
    author: 'Custom',
    templateVersion: '1.0.0',
    formatVersion: 1,
    categories: ['Custom'],
    orientation: landscape ? 'landscape' : 'portrait',
    constants: [
      { [FOREGROUND_CONST]: DARK_BG_COLOR },
      { [BACKGROUND_CONST]: LIGHT_BG_COLOR },
      { mobileMaxWidth: 1000 },
      { offsetX: 0 },
      { offsetY: 0 },
      { mobileOffsetY: 0 },
    ],
    items: [buildBackgroundItem()],
  }
  return JSON.stringify(template, null, 2)
}

/** Prepend custom entries before main entries. Does not mutate inputs. */
export function mergeRegistries(main: TemplateRegistry, custom: TemplateRegistry): TemplateRegistry {
  return { templates: [...custom.templates, ...main.templates] }
}
