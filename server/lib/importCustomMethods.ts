/**
 * Auto-import custom-methods entries from the methods registry into the
 * custom collection so they appear as editable templates.
 *
 * Skips entries already present in custom-registry.json or debug-registry.json
 * (matched by rmMethodsId).
 */

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

interface MethodsRegistryEntry {
  name: string
  filename: string
  iconCode: string
  landscape?: boolean
  categories: string[]
  rmMethodsId?: string
  origin?: string
  iconData?: string
}

/** Paths required for importing custom-methods entries into the custom collection. */
export interface ImportCustomMethodsConfig {
  /** Path to `methods-registry.json` (source of custom-methods entries). */
  methodsRegistry: string
  /** Path to `custom-registry.json` (target for imported entries). */
  customRegistry: string
  /** Directory for custom `.template` files (destination for copied templates). */
  customDir: string
  /** Directory containing methods `.template` files (source for copies). */
  methodsDir: string
  /** Path to `debug-registry.json` (entries here are skipped to avoid duplicates). */
  debugRegistry: string
}

/**
 * Import `custom-methods` entries from the methods registry into the custom collection.
 *
 * For each methods registry entry with `origin: 'custom-methods'` that isn't already
 * in the custom or debug registries (matched by `rmMethodsId`), copies the `.template`
 * file into `customDir` and adds a registry entry to `custom-registry.json`.
 *
 * @param config - Paths for registries and template directories.
 * @returns The number of templates imported (0 if none were new).
 */
export function importCustomMethodsEntries(config: ImportCustomMethodsConfig): number {
  let methodsEntries: MethodsRegistryEntry[]
  try {
    const raw = JSON.parse(readFileSync(config.methodsRegistry, 'utf8')) as { templates: MethodsRegistryEntry[] }
    methodsEntries = raw.templates.filter(e => e.origin === 'custom-methods')
  } catch {
    return 0
  }

  if (methodsEntries.length === 0) return 0

  let customRegistry: { templates: Array<{ filename: string; rmMethodsId?: string; [k: string]: unknown }> }
  try {
    customRegistry = JSON.parse(readFileSync(config.customRegistry, 'utf8')) as typeof customRegistry
  } catch {
    customRegistry = { templates: [] }
  }

  const existingIds = new Set(customRegistry.templates.map(e => e.rmMethodsId).filter(Boolean))

  // Also skip entries that already exist in the debug registry
  try {
    const debugReg = JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as { templates: Array<{ rmMethodsId?: string }> }
    for (const entry of debugReg.templates) {
      if (entry.rmMethodsId) existingIds.add(entry.rmMethodsId)
    }
  } catch { /* no debug registry */ }

  let imported = 0

  mkdirSync(config.customDir, { recursive: true })

  for (const entry of methodsEntries) {
    if (!entry.rmMethodsId || existingIds.has(entry.rmMethodsId)) continue

    const srcPath = resolve(config.methodsDir, `${entry.rmMethodsId}.template`)
    if (!existsSync(srcPath)) continue

    const prefix = entry.landscape ? 'LS' : 'P'
    const customSlug = `${prefix} ${entry.name}`
    const destPath = resolve(config.customDir, `${customSlug}.template`)
    copyFileSync(srcPath, destPath)

    customRegistry.templates.push({
      name: entry.name,
      filename: `custom/${customSlug}`,
      iconCode: entry.iconCode,
      landscape: entry.landscape ?? false,
      categories: entry.categories,
      isCustom: true,
      rmMethodsId: entry.rmMethodsId,
      ...(entry.iconData ? { iconData: entry.iconData } : {}),
    })
    imported++
  }

  if (imported > 0) {
    writeFileSync(config.customRegistry, JSON.stringify(customRegistry, null, 2) + '\n', 'utf8')
  }

  return imported
}
