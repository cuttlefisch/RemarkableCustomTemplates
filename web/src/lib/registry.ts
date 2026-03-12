/**
 * CRUD operations for the template registry (templates.json).
 */

import type { TemplateRegistry, TemplateRegistryEntry } from '../types/registry'

export function parseRegistry(raw: unknown): TemplateRegistry {
  if (typeof raw !== 'object' || raw === null) throw new Error('Registry must be a JSON object')
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r['templates'])) throw new Error('Registry missing "templates" array')

  return {
    templates: (r['templates'] as unknown[]).map(parseEntry),
  }
}

function parseEntry(raw: unknown): TemplateRegistryEntry {
  if (typeof raw !== 'object' || raw === null) throw new Error('Registry entry must be an object')
  const e = raw as Record<string, unknown>
  if (typeof e['name'] !== 'string') throw new Error('Entry missing "name"')
  if (typeof e['filename'] !== 'string') throw new Error('Entry missing "filename"')
  if (typeof e['iconCode'] !== 'string') throw new Error('Entry missing "iconCode"')
  if (!Array.isArray(e['categories'])) throw new Error('Entry missing "categories"')

  return {
    name: e['name'] as string,
    filename: e['filename'] as string,
    iconCode: e['iconCode'] as string,
    landscape: e['landscape'] === true,
    categories: (e['categories'] as unknown[]).map(c => {
      if (typeof c !== 'string') throw new Error('Category must be a string')
      return c
    }),
    ...(e['isCustom'] === true ? { isCustom: true as const } : {}),
  }
}

export function addEntry(
  registry: TemplateRegistry,
  entry: TemplateRegistryEntry,
): TemplateRegistry {
  return { templates: [...registry.templates, entry] }
}

export function removeEntry(registry: TemplateRegistry, filename: string): TemplateRegistry {
  return { templates: registry.templates.filter(t => t.filename !== filename) }
}

export function updateEntry(
  registry: TemplateRegistry,
  filename: string,
  patch: Partial<Omit<TemplateRegistryEntry, 'filename'>>,
): TemplateRegistry {
  return {
    templates: registry.templates.map(t =>
      t.filename === filename ? { ...t, ...patch } : t,
    ),
  }
}

export function filterByCategory(
  registry: TemplateRegistry,
  category: string,
): TemplateRegistryEntry[] {
  return registry.templates.filter(t => t.categories.includes(category))
}
