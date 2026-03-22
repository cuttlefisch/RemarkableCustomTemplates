/**
 * Backfill iconData for registry entries that are missing it.
 * Runs once on server startup — idempotent and non-destructive.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../config.ts'
import { parseTemplate } from '../../src/lib/parser.ts'
import { generateTemplateIcon } from '../../src/lib/iconGenerator.ts'

interface RegistryFile {
  path: string
  templateDir: string
}

function backfillRegistry(registryPath: string, templateDir: string): number {
  if (!existsSync(registryPath)) return 0

  let registry: { templates: Array<Record<string, unknown>> }
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  } catch { return 0 }

  if (!Array.isArray(registry.templates)) return 0

  let updated = 0
  for (const entry of registry.templates) {
    if (typeof entry.iconData === 'string') continue
    const filename = entry.filename as string
    if (!filename) continue

    // Strip the prefix (e.g. "custom/", "methods/", "samples/") to get the base
    const parts = filename.split('/')
    const baseName = parts.length > 1 ? parts.slice(1).join('/') : filename
    const tplPath = resolve(templateDir, `${baseName}.template`)

    if (!existsSync(tplPath)) continue

    try {
      const tpl = parseTemplate(JSON.parse(readFileSync(tplPath, 'utf8')))
      entry.iconData = generateTemplateIcon(tpl)
      updated++
    } catch { /* skip */ }
  }

  if (updated > 0) {
    writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8')
  }

  return updated
}

export function backfillAllIcons(config: ServerConfig): void {
  const registries: RegistryFile[] = [
    { path: config.customRegistry, templateDir: config.customDir },
    { path: config.methodsRegistry, templateDir: config.methodsDir },
    { path: config.debugRegistry, templateDir: config.debugDir },
    { path: config.samplesRegistry, templateDir: config.samplesDir },
    { path: resolve(config.officialDir, 'templates.json'), templateDir: config.officialDir },
  ]

  let total = 0
  for (const { path, templateDir } of registries) {
    total += backfillRegistry(path, templateDir)
  }

  if (total > 0) {
    console.log(`[backfill] Generated iconData for ${total} template(s)`)
  }
}
