import type { TemplateRegistry, TemplateRegistryEntry } from '../types/registry'

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
export function buildCustomEntry(name: string, landscape: boolean): TemplateRegistryEntry {
  const prefix = landscape ? 'LS' : 'P'
  return {
    name,
    filename: `custom/${prefix} ${name}`,
    iconCode: 'e9d1',
    landscape,
    categories: ['Custom'],
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
export function mergeRegistries(
  main: TemplateRegistry,
  custom: TemplateRegistry,
): TemplateRegistry {
  return { templates: [...custom.templates, ...main.templates] }
}
