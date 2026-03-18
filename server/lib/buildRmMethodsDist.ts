/**
 * Build rm-methods-dist/ from custom + debug templates.
 * Shared between the export endpoint (ZIP download) and deploy (writes to disk).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ServerConfig } from '../config.ts'
import { resolveStringConstants } from '../../src/lib/customTemplates.ts'
import { parseTemplate } from '../../src/lib/parser.ts'
import { generateTemplateIcon } from '../../src/lib/iconGenerator.ts'
import {
  templateContentHash,
  resolveTemplateVersion,
  buildRmMethodsMetadata,
  type ManifestEntry,
  type RmMethodsManifest,
} from '../../src/lib/rmMethods.ts'

export interface RmMethodsBuildResult {
  /** Map of filename → file content (UTF-8 strings) */
  files: Record<string, string>
  manifest: RmMethodsManifest
  templateCount: number
}

export function buildRmMethodsDist(config: ServerConfig): RmMethodsBuildResult {
  type RegEntry = { filename: string; name: string; landscape?: boolean; categories: string[]; rmMethodsId?: string }

  let customReg: { templates: RegEntry[] } = { templates: [] }
  let debugReg: { templates: RegEntry[] } = { templates: [] }
  try { customReg = JSON.parse(readFileSync(config.customRegistry, 'utf8')) as typeof customReg } catch { /* empty */ }
  try { debugReg = JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as typeof debugReg } catch { /* empty */ }

  // Assign UUIDs to entries that don't have one
  let customDirty = false
  let debugDirty = false
  for (const entry of customReg.templates) {
    if (!entry.rmMethodsId) { entry.rmMethodsId = randomUUID(); customDirty = true }
  }
  for (const entry of debugReg.templates) {
    if (!entry.rmMethodsId) { entry.rmMethodsId = randomUUID(); debugDirty = true }
  }
  if (customDirty) writeFileSync(config.customRegistry, JSON.stringify(customReg, null, 2), 'utf8')
  if (debugDirty) writeFileSync(config.debugRegistry, JSON.stringify(debugReg, null, 2), 'utf8')

  // Load previous manifest for version tracking
  const manifestPath = resolve(config.rmMethodsDistDir, '.manifest')
  let prevManifest: RmMethodsManifest = { exportedAt: '', templates: {} }
  try { prevManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as RmMethodsManifest } catch { /* first build */ }

  const nowMs = String(Date.now())
  const files: Record<string, string> = {}
  const manifestTemplates: Record<string, ManifestEntry> = {}

  function addEntry(entry: RegEntry, templateDir: string, filePrefix: string) {
    const uuid = entry.rmMethodsId!
    const shortName = entry.filename.replace(new RegExp(`^${filePrefix}/`), '')
    const tplPath = resolve(templateDir, `${shortName}.template`)
    if (!existsSync(tplPath)) return

    const rawContent = readFileSync(tplPath, 'utf8')
    const resolvedContent = resolveStringConstants(rawContent)

    let labels: string[]
    try {
      const tplObj = JSON.parse(resolvedContent) as Record<string, unknown>
      const tpl = parseTemplate(tplObj)
      const iconData = generateTemplateIcon(tpl)
      labels = (tpl.labels ?? tpl.categories ?? ['Custom']).filter((l: string) => l.length > 0)
      if (labels.length === 0) labels = ['Custom']

      const enriched: Record<string, unknown> = { ...tplObj, iconData, labels }
      const contentHash = templateContentHash(enriched)
      const prevEntry = prevManifest.templates[uuid]
      const sourceVersion = typeof tplObj.templateVersion === 'string' ? tplObj.templateVersion : '1.0.0'
      const resolvedVersion = resolveTemplateVersion({ prevEntry, currentHash: contentHash, sourceVersion })
      enriched.templateVersion = resolvedVersion

      files[`${uuid}.template`] = JSON.stringify(enriched, null, 2)

      manifestTemplates[uuid] = {
        name: entry.name,
        templateVersion: resolvedVersion,
        contentHash,
        createdTime: prevEntry?.createdTime ?? nowMs,
      }
    } catch {
      files[`${uuid}.template`] = resolvedContent
      labels = (entry.categories ?? ['Custom']).filter((l: string) => l.length > 0)
      if (labels.length === 0) labels = ['Custom']

      manifestTemplates[uuid] = {
        name: entry.name,
        templateVersion: '1.0.0',
        contentHash: 'sha256:unknown',
        createdTime: prevManifest.templates[uuid]?.createdTime ?? nowMs,
      }
    }

    const metadata = buildRmMethodsMetadata({
      visibleName: entry.name,
      createdTime: prevManifest.templates[uuid]?.createdTime ?? manifestTemplates[uuid]?.createdTime,
      nowMs,
    })
    files[`${uuid}.metadata`] = JSON.stringify(metadata, null, 2)
    files[`${uuid}.content`] = '{}'
  }

  for (const entry of customReg.templates) addEntry(entry, config.customDir, 'custom')
  for (const entry of debugReg.templates) addEntry(entry, config.debugDir, 'debug')

  const manifest: RmMethodsManifest = { exportedAt: nowMs, templates: manifestTemplates }
  files['.manifest'] = JSON.stringify(manifest, null, 2)

  return { files, manifest, templateCount: Object.keys(manifestTemplates).length }
}

/** Write the build result to rm-methods-dist/ on disk, removing stale files. */
export function writeRmMethodsDist(config: ServerConfig, result: RmMethodsBuildResult): void {
  mkdirSync(config.rmMethodsDistDir, { recursive: true })
  for (const [name, content] of Object.entries(result.files)) {
    writeFileSync(resolve(config.rmMethodsDistDir, name), content, 'utf8')
  }

  // Clean stale files not in the current build
  const expectedFiles = new Set(Object.keys(result.files))
  for (const file of readdirSync(config.rmMethodsDistDir)) {
    if (!expectedFiles.has(file)) {
      unlinkSync(resolve(config.rmMethodsDistDir, file))
    }
  }
}
