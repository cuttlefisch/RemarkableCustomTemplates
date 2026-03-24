/**
 * CRUD operations for the template registry (templates.json).
 */

import type { TemplateRegistry, TemplateRegistryEntry } from '../types/registry'

/**
 * Parse and validate raw JSON into a typed template registry.
 *
 * @param raw - Parsed JSON value from a `templates.json` file
 * @returns A validated registry with typed entries
 * @throws If the structure is invalid or required fields are missing
 */
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
    ...(typeof e['rmMethodsId'] === 'string' ? { rmMethodsId: e['rmMethodsId'] } : {}),
    ...(typeof e['origin'] === 'string' ? { origin: e['origin'] } : {}),
    ...(typeof e['iconData'] === 'string' ? { iconData: e['iconData'] } : {}),
  }
}

/**
 * Append an entry to the registry. Does not mutate the original.
 *
 * @param registry - The existing registry
 * @param entry - The new entry to append
 * @returns A new registry with the entry added at the end
 */
export function addEntry(
  registry: TemplateRegistry,
  entry: TemplateRegistryEntry,
): TemplateRegistry {
  return { templates: [...registry.templates, entry] }
}

/**
 * Remove an entry by filename. Does not mutate the original.
 *
 * @param registry - The existing registry
 * @param filename - The filename to match for removal
 * @returns A new registry with the matching entry removed
 */
export function removeEntry(registry: TemplateRegistry, filename: string): TemplateRegistry {
  return { templates: registry.templates.filter(t => t.filename !== filename) }
}

/**
 * Update fields of an entry matched by filename. Does not mutate the original.
 *
 * @param registry - The existing registry
 * @param filename - The filename to match
 * @param patch - Partial fields to merge into the matched entry
 * @returns A new registry with the matched entry updated
 */
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

/**
 * Return all entries that belong to the given category.
 *
 * @param registry - The registry to filter
 * @param category - Category name to match (e.g. `"Custom"`, `"Life/organize"`)
 * @returns Matching entries (may be empty)
 */
export function filterByCategory(
  registry: TemplateRegistry,
  category: string,
): TemplateRegistryEntry[] {
  return registry.templates.filter(t => t.categories.includes(category))
}
