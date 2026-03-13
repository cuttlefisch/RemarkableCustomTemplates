/**
 * Utilities for creating and managing user-defined custom templates.
 *
 * Provides: dark-mode toggling, name validation/slugification,
 * default template scaffolding, and registry merging.
 */

import type { TemplateRegistry, TemplateRegistryEntry } from '../types/registry'
import type { GroupItem } from '../types/template'

export const DARK_BG_COLOR  = '#000000'
export const LIGHT_BG_COLOR = '#ffffff'

/** Full-page filled rectangle used as dark background, identified by id "bg". */
export function buildBackgroundItem(): GroupItem {
  return {
    id: 'bg',
    type: 'group',
    boundingBox: { x: 0, y: 0, width: 'templateWidth', height: 'templateHeight' },
    repeat: { rows: 0, columns: 0 },
    children: [{
      type: 'path',
      strokeColor: DARK_BG_COLOR,
      fillColor: DARK_BG_COLOR,
      antialiasing: false,
      data: ['M', 0, 0, 'L', 'templateWidth', 0, 'L', 'templateWidth', 'templateHeight', 'L', 0, 'templateHeight', 'Z'],
    }],
  }
}

/**
 * Toggle dark mode on a template JSON string.
 * dark=true  — prepend bg item + add "Dark" to categories
 * dark=false — remove bg item + remove "Dark" from categories
 */
export function toggleDark(json: string, dark: boolean): string {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const items = Array.isArray(parsed.items) ? parsed.items : []
  const cats = Array.isArray(parsed.categories) ? (parsed.categories as string[]) : []

  if (dark) {
    const hasBg = items.some((item: unknown) =>
      typeof item === 'object' && item !== null && (item as Record<string, unknown>).id === 'bg',
    )
    const newItems = hasBg ? items : [buildBackgroundItem(), ...items]
    const newCats = cats.includes('Dark') ? cats : ['Dark', ...cats]
    return JSON.stringify({ ...parsed, items: newItems, categories: newCats }, null, 2)
  } else {
    const newItems = items.filter((item: unknown) =>
      !(typeof item === 'object' && item !== null && (item as Record<string, unknown>).id === 'bg'),
    )
    const newCats = cats.filter(c => c !== 'Dark')
    return JSON.stringify({ ...parsed, items: newItems, categories: newCats }, null, 2)
  }
}

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
): TemplateRegistryEntry {
  const prefix = landscape ? 'LS' : 'P'
  return {
    name,
    filename: `custom/${prefix} ${name}`,
    iconCode: 'e9d1',
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
      { mobileMaxWidth: 1000 },
      { offsetX: 0 },
      { offsetY: 0 },
      { mobileOffsetY: 0 },
    ],
    items: [],
  }
  return JSON.stringify(template, null, 2)
}

/** Prepend custom entries before main entries. Does not mutate inputs. */
export function mergeRegistries(main: TemplateRegistry, custom: TemplateRegistry): TemplateRegistry {
  return { templates: [...custom.templates, ...main.templates] }
}
