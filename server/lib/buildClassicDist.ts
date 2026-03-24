/**
 * Build dist-deploy/ from official + custom + debug templates.
 * Shared between the export endpoint (ZIP download) and deploy-classic (writes to disk).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../config.ts'
import { resolveStringConstants } from '../../src/lib/customTemplates.ts'

function escapeUnicode(str: string): string {
  return str.replace(/[\u0080-\uFFFF]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

/** Strip supportedScreens from template JSON — it causes xochitl to hide templates on non-matching devices. */
function stripSupportedScreens(content: string): string {
  try {
    const obj = JSON.parse(content) as Record<string, unknown>
    if ('supportedScreens' in obj) {
      delete obj.supportedScreens
      return JSON.stringify(obj, null, 2)
    }
  } catch { /* not valid JSON, return as-is */ }
  return content
}

/** Result of building the classic (non-methods) distribution for deploy or export. */
export interface ClassicBuildResult {
  /** Map of filename to file content — Buffer for binary `.template` files, string for the registry. */
  files: Record<string, Buffer | string>
  /** Number of `.template` files included in the build. */
  templateCount: number
}

/**
 * Build the classic template distribution by merging official, debug, and custom templates.
 *
 * Merging priority: debug entries override official entries (by filename),
 * then custom entries are appended (skipping any that collide with official filenames).
 * Custom and debug templates have string constants resolved and `supportedScreens` stripped.
 *
 * @param config - Server configuration with paths to registries and template directories.
 * @returns The build result containing all file contents and template count.
 * @throws If the official `templates.json` registry has not been imported yet.
 */
export function buildClassicDist(config: ServerConfig): ClassicBuildResult {
  type RegEntry = { filename: string; name?: string; categories?: string[]; isCustom?: boolean; [key: string]: unknown }

  const officialRegistryPath = resolve(config.officialDir, 'templates.json')
  if (!existsSync(officialRegistryPath)) {
    throw new Error('Official templates not loaded. Import classic templates first.')
  }

  const officialRegistry = JSON.parse(readFileSync(officialRegistryPath, 'utf8')) as { templates: RegEntry[] }
  let customRegistry: { templates: RegEntry[] } = { templates: [] }
  try { customRegistry = JSON.parse(readFileSync(config.customRegistry, 'utf8')) as typeof customRegistry } catch { /* empty */ }

  let debugRegistry: { templates: RegEntry[] } = { templates: [] }
  try { debugRegistry = JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as typeof debugRegistry } catch { /* empty */ }

  // Flatten debug entries (strip "debug/" prefix)
  const debugEntries = debugRegistry.templates.map(({ filename, ...rest }) => ({
    ...rest,
    filename: filename.replace(/^debug\//, ''),
  }))
  const debugFilenames = new Set(debugEntries.map(e => e.filename))

  // Flatten custom entries (strip "custom/" prefix, drop isCustom)
  const officialFilenames = new Set(officialRegistry.templates.map(e => e.filename))
  const customEntries = customRegistry.templates
    .map(({ isCustom: _drop, filename, ...rest }) => ({ ...rest, filename: filename.replace(/^custom\//, '') }))
    .filter(e => !officialFilenames.has(e.filename))

  // Sync categories from custom .template files
  const syncedCustomEntries = customEntries.map(entry => {
    const tplPath = resolve(config.customDir, `${entry.filename}.template`)
    if (existsSync(tplPath)) {
      try {
        const tpl = JSON.parse(readFileSync(tplPath, 'utf8')) as { categories?: unknown }
        if (Array.isArray(tpl.categories)) {
          return { ...entry, categories: ['Custom', ...tpl.categories.filter((c: unknown) => c !== 'Custom')] }
        }
      } catch (err) {
        console.warn(`[build-classic] Failed to sync categories from "${entry.filename}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return entry
  })

  // Merge registry: debug overrides official, then append custom
  const filteredOfficial = officialRegistry.templates.filter(e => !debugFilenames.has(e.filename))
  const mergedRegistry = {
    ...officialRegistry,
    templates: [...debugEntries, ...filteredOfficial, ...syncedCustomEntries],
  }

  const files: Record<string, Buffer | string> = {}
  const copiedFilenames = new Set<string>()

  // Registry
  files['templates.json'] = escapeUnicode(JSON.stringify(mergedRegistry, null, 2)) + '\n'

  // Official .template files
  if (existsSync(config.officialDir)) {
    for (const file of readdirSync(config.officialDir)) {
      if (file.endsWith('.template')) {
        files[file] = readFileSync(resolve(config.officialDir, file))
        copiedFilenames.add(file)
      }
    }
  }

  // Debug .template files (with resolveStringConstants)
  for (const entry of debugEntries) {
    const file = `${entry.filename}.template`
    const filePath = resolve(config.debugDir, file)
    if (existsSync(filePath) && !copiedFilenames.has(file)) {
      files[file] = stripSupportedScreens(resolveStringConstants(readFileSync(filePath, 'utf8')))
      copiedFilenames.add(file)
    }
  }

  // Custom .template files (with resolveStringConstants)
  if (existsSync(config.customDir)) {
    for (const file of readdirSync(config.customDir)) {
      if (file.endsWith('.template') && !copiedFilenames.has(file)) {
        files[file] = stripSupportedScreens(resolveStringConstants(readFileSync(resolve(config.customDir, file), 'utf8')))
        copiedFilenames.add(file)
      }
    }
  }

  return { files, templateCount: copiedFilenames.size }
}

/**
 * Write the classic build result to `dist-deploy/` on disk.
 * @param config - Server configuration with the `classicDistDir` path.
 * @param result - The build result from {@link buildClassicDist}.
 */
export function writeClassicDist(config: ServerConfig, result: ClassicBuildResult): void {
  mkdirSync(config.classicDistDir, { recursive: true })
  for (const [name, content] of Object.entries(result.files)) {
    if (Buffer.isBuffer(content)) {
      writeFileSync(resolve(config.classicDistDir, name), content)
    } else {
      writeFileSync(resolve(config.classicDistDir, name), content, 'utf8')
    }
  }
}
