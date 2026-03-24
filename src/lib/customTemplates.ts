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

/** Default dark-mode background / light-mode foreground color. */
export const DARK_BG_COLOR  = '#000000'
/** Default light-mode background / dark-mode foreground color. */
export const LIGHT_BG_COLOR = '#ffffff'

/** Constant name used for foreground color in custom templates. */
export const FOREGROUND_CONST = 'foreground'
/** Constant name used for background color in custom templates. */
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

/**
 * Find the hex color value for a named constant in the constants array.
 *
 * @param constants - The template's constants array
 * @param key - The constant name to look up (e.g. `'foreground'`)
 * @returns The hex color string, or `undefined` if not found
 */
export function findColorConstantValue(constants: ConstantEntry[], key: string): string | undefined {
  for (const entry of constants) {
    if (key in entry) {
      const v = entry[key]
      if (typeof v === 'string' && v.startsWith('#')) return v
    }
  }
  return undefined
}

/**
 * Insert or update a color constant in the constants array.
 *
 * If the key already exists, replaces it in-place. Otherwise, prepends it.
 *
 * @param constants - The template's constants array
 * @param key - The constant name
 * @param value - The hex color value
 * @returns A new constants array with the value set
 */
export function upsertColorConstant(constants: ConstantEntry[], key: string, value: string): ConstantEntry[] {
  const idx = constants.findIndex(e => key in e)
  if (idx >= 0) {
    return constants.map((e, i) => i === idx ? { [key]: value } : e)
  }
  return [{ [key]: value }, ...constants]
}

// ─── Invert colors ────────────────────────────────────────────────────────────

/**
 * Swap foreground and background constant values in a template JSON string.
 *
 * Defaults to light-mode values (`fg=#000000`, `bg=#ffffff`) when constants are absent.
 * Does not modify items or categories.
 *
 * @param json - Template JSON string
 * @returns Modified JSON string with swapped colors
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
 * Resolve and strip non-scalar constants at device-export time.
 *
 * A constant is "scalar" if its value is a number or a string expression that
 * evaluates to a number (e.g. `"templateWidth / 2"`). Non-scalar constants
 * (hex colors, arbitrary text) are inlined into item fields and removed from
 * the constants array so the output is device-safe.
 *
 * Inlining rules:
 * - `fillColor` / `strokeColor` -- exact name lookup
 * - `TextItem.text` -- exact name lookup
 * - ScalarValue expression strings (data tokens, boundingBox, repeat, etc.) -- word-boundary substitution
 *
 * @param json - Template JSON string with potentially non-scalar constants
 * @returns Template JSON string safe for device deployment
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
          // Complex expressions (ternary, ||/&&, forward references) can't be
          // evaluated at export time. Keep them in the constants array so the
          // device evaluates them natively. Do NOT add to nonScalarMap — that
          // would inline the raw expression string into bounding-box / data
          // fields, producing expressions the device can't parse.
          keptConstants.push(entry)
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
    } else if (typeof result.fillColor === 'string' && !result.fillColor.startsWith('#')) {
      console.warn(`[resolveStringConstants] Unresolved fillColor "${result.fillColor}" — defaulting to "#000000"`)
      result.fillColor = '#000000'
    }
    if (typeof result.strokeColor === 'string' && result.strokeColor in nonScalarMap) {
      result.strokeColor = nonScalarMap[result.strokeColor]
    } else if (typeof result.strokeColor === 'string' && !result.strokeColor.startsWith('#')) {
      console.warn(`[resolveStringConstants] Unresolved strokeColor "${result.strokeColor}" — defaulting to "#000000"`)
      result.strokeColor = '#000000'
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
 * Ensure foreground/background constants and the background item exist.
 *
 * Appends light-mode defaults (`fg=#000000`, `bg=#ffffff`) for any missing
 * constants, and prepends the `bg` GroupItem if absent. Idempotent.
 *
 * @param json - Template JSON string
 * @returns Template JSON string with color constants and bg item guaranteed
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
 * Replace hardcoded black/white colors with `foreground`/`background` constant
 * references throughout the item tree (recursively).
 *
 * Applied when forking official templates so color inversion works out of the box.
 * Maps: `#000000` -> `foreground`, `#ffffff` -> `background`.
 *
 * @param json - Template JSON string
 * @returns Template JSON string with color references replacing hex literals
 */
export function mapForegroundColors(json: string): string {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const items = Array.isArray(parsed.items) ? (parsed.items as unknown[]) : []

  function mapItem(item: unknown): unknown {
    if (typeof item !== 'object' || item === null) return item
    const result = { ...(item as Record<string, unknown>) }
    if (result.type === 'path') {
      // strokeColor undefined → device defaults to black → map to foreground
      // strokeColor #000000 → explicitly black → map to foreground
      if (result.strokeColor === '#000000' || result.strokeColor === undefined) {
        result.strokeColor = FOREGROUND_CONST
      }
      // strokeColor #ffffff → white stroke → map to background
      if (result.strokeColor === '#ffffff') {
        result.strokeColor = BACKGROUND_CONST
      }
      // fillColor #000000 → explicitly black fill → map to foreground
      // fillColor undefined → no fill (transparent) → leave as-is
      if (result.fillColor === '#000000') {
        result.fillColor = FOREGROUND_CONST
      }
      // fillColor #ffffff → white fill → map to background
      if (result.fillColor === '#ffffff') {
        result.fillColor = BACKGROUND_CONST
      }
    }
    if (Array.isArray(result.children)) {
      result.children = result.children.map(mapItem)
    }
    return result
  }

  return JSON.stringify({ ...parsed, items: items.map(mapItem) }, null, 2)
}

/**
 * Ensure the `bg` item references the `background` constant by name.
 *
 * Replaces the existing bg item with a fresh one built from `buildBackgroundItem()`.
 * No-op if the bg item is absent. Handles migration from templates that stored
 * resolved hex values.
 *
 * @param json - Template JSON string
 * @returns Template JSON string with the bg item's colors normalised
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

/**
 * Convert a human-readable name to a URL/filename-safe slug.
 *
 * @param name - The input name (e.g. `"My Grid 2"`)
 * @returns A lowercase, hyphen-separated slug (e.g. `"my-grid-2"`)
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

/**
 * Validate a custom template name for uniqueness and format.
 *
 * @param name - The proposed template name
 * @param existingNames - Names already in use (case-insensitive comparison)
 * @returns An error message string, or `null` if the name is valid
 */
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

/**
 * Build a registry entry for a new custom template.
 *
 * The filename is auto-generated with an orientation prefix (`LS` or `P`).
 *
 * @param name - Human-readable template name
 * @param landscape - Whether the template is landscape-oriented
 * @param categories - Category tags (defaults to `['Custom']`)
 * @param iconCode - Unicode icon glyph (defaults to US College icon)
 * @returns A new registry entry with `isCustom: true`
 */
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

/**
 * Build a starter template JSON string for a brand-new custom template.
 *
 * Includes foreground/background color constants, a background item, and
 * placeholder constants for mobile layout offsets.
 *
 * @param name - Template name
 * @param landscape - Whether to create a landscape template
 * @returns Pretty-printed JSON string
 */
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

/**
 * Ensure `"Custom"` is the first category; preserve all other tags.
 *
 * @param cats - Existing category list from the template
 * @returns A new array with `"Custom"` first, followed by the original tags (minus duplicates)
 */
export function mergeCategories(cats: string[]): string[] {
  return ['Custom', ...cats.filter(c => c !== 'Custom')]
}

/**
 * Merge two registries, with custom entries taking precedence.
 *
 * Custom entries are prepended before main entries. Duplicate `rmMethodsId`
 * values are deduplicated (first occurrence wins). Does not mutate inputs.
 *
 * @param main - The primary (official/methods) registry
 * @param custom - The user's custom registry
 * @returns A merged registry with custom entries first
 */
export function mergeRegistries(main: TemplateRegistry, custom: TemplateRegistry): TemplateRegistry {
  const all = [...custom.templates, ...main.templates]
  const seen = new Set<string>()
  const deduped = all.filter(entry => {
    if (!entry.rmMethodsId) return true
    if (seen.has(entry.rmMethodsId)) return false
    seen.add(entry.rmMethodsId)
    return true
  })
  return { templates: deduped }
}

/**
 * Look up the US College icon code from the loaded registry.
 *
 * Falls back to the known glyph `\ue9d8` if the registry doesn't contain a match.
 *
 * @param registry - The loaded template registry (may be `null`)
 * @param landscape - Whether to prefer the landscape variant
 * @returns A Unicode icon code string
 */
export function getCollegeIconCode(registry: TemplateRegistry | null, landscape: boolean): string {
  const entries = registry?.templates ?? []
  const match = entries.find(t => t.name === 'US College' && !!(t.landscape) === landscape)
  if (match) return match.iconCode
  const any = entries.find(t => t.name === 'US College')
  return any?.iconCode ?? '\ue9d8'
}
