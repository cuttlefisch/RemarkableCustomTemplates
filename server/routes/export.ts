/**
 * GET /api/export-templates — zip official + custom + debug templates
 * GET /api/export-rm-methods — zip in rm_methods UUID format
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { zipSync, strToU8 } from 'fflate'
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

function escapeUnicode(str: string): string {
  return str.replace(/[\u0080-\uFFFF]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

export default function exportRoutes(app: FastifyInstance, config: ServerConfig) {
  // GET /api/export-templates
  app.get('/api/export-templates', async (_request, reply) => {
    const officialRegistryPath = resolve(config.officialDir, 'templates.json')
    if (!existsSync(officialRegistryPath)) {
      return reply.status(404).send({ error: 'Official templates not loaded. Copy files to remarkable_official_templates/ first.' })
    }

    const officialRegistry = JSON.parse(readFileSync(officialRegistryPath, 'utf8')) as { templates: Array<{ filename: string }> }
    let customRegistry: { templates: Array<{ filename: string }> } = { templates: [] }
    try {
      customRegistry = JSON.parse(readFileSync(config.customRegistry, 'utf8')) as typeof customRegistry
    } catch { /* no custom templates */ }

    let debugRegistry: { templates: Array<{ filename: string }> } = { templates: [] }
    try { debugRegistry = JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as typeof debugRegistry } catch { /* empty */ }
    const debugEntries = debugRegistry.templates.map(e => ({ ...e, filename: e.filename.replace(/^debug\//, '') }))
    const debugFilenames = new Set(debugEntries.map(e => e.filename))

    const officialFilenames = new Set(officialRegistry.templates.map(e => e.filename))
    const warningFiles: string[] = []
    const customEntries = customRegistry.templates
      .map(e => ({ ...e, filename: e.filename.replace(/^custom\//, '') }))
      .filter(e => {
        if (officialFilenames.has(e.filename)) {
          warningFiles.push(e.filename)
          return false
        }
        return true
      })

    const syncedCustomEntries = customEntries.map(entry => {
      const tplPath = resolve(config.customDir, `${entry.filename}.template`)
      if (existsSync(tplPath)) {
        try {
          const tpl = JSON.parse(readFileSync(tplPath, 'utf8')) as { categories?: unknown }
          if (Array.isArray(tpl.categories)) {
            return { ...entry, categories: ['Custom', ...tpl.categories.filter((c: unknown) => c !== 'Custom')] }
          }
        } catch { /* ignore */ }
      }
      return entry
    })

    const filteredOfficial = officialRegistry.templates.filter(e => !debugFilenames.has(e.filename))
    const mergedRegistry = {
      ...officialRegistry,
      templates: [...debugEntries, ...filteredOfficial, ...syncedCustomEntries],
    }

    const fileMap: Record<string, Uint8Array> = {}
    fileMap['templates.json'] = strToU8(escapeUnicode(JSON.stringify(mergedRegistry, null, 2)))

    for (const file of readdirSync(config.officialDir)) {
      if (file.endsWith('.template')) {
        fileMap[file] = readFileSync(resolve(config.officialDir, file))
      }
    }

    if (existsSync(config.customDir)) {
      for (const file of readdirSync(config.customDir)) {
        if (file.endsWith('.template')) {
          const flatName = file
          if (!fileMap[flatName]) {
            const raw = readFileSync(resolve(config.customDir, file), 'utf8')
            fileMap[flatName] = strToU8(resolveStringConstants(raw))
          }
        }
      }
    }

    if (existsSync(config.debugDir)) {
      for (const entry of debugEntries) {
        const shortName = entry.filename
        const filePath = resolve(config.debugDir, `${shortName}.template`)
        if (existsSync(filePath) && !fileMap[`${shortName}.template`]) {
          fileMap[`${shortName}.template`] = strToU8(resolveStringConstants(readFileSync(filePath, 'utf8')))
        }
      }
    }

    const zipped = zipSync(fileMap)
    const headers: Record<string, string> = {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="remarkable-templates.zip"',
      'content-length': String(zipped.length),
    }
    if (warningFiles.length > 0) {
      headers['x-skipped-files'] = warningFiles.join(', ')
    }
    return reply.headers(headers).send(Buffer.from(zipped))
  })

  // GET /api/export-rm-methods
  app.get('/api/export-rm-methods', async (_request, reply) => {
    let customReg: { templates: Array<{ filename: string; name: string; landscape?: boolean; categories: string[]; rmMethodsId?: string }> } = { templates: [] }
    let debugReg: { templates: Array<{ filename: string; name: string; landscape?: boolean; categories: string[]; rmMethodsId?: string }> } = { templates: [] }
    try { customReg = JSON.parse(readFileSync(config.customRegistry, 'utf8')) as typeof customReg } catch { /* empty */ }
    try { debugReg = JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as typeof debugReg } catch { /* empty */ }

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

    const MANIFEST_PATH = resolve(config.rmMethodsDistDir, '.manifest')
    let prevManifest: RmMethodsManifest = { exportedAt: '', templates: {} }
    try { prevManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as RmMethodsManifest } catch { /* first export */ }

    const nowMs = String(Date.now())
    const fileMap: Record<string, Uint8Array> = {}
    const manifestTemplates: Record<string, ManifestEntry> = {}

    function addEntry(
      entry: { filename: string; name: string; landscape?: boolean; categories: string[]; rmMethodsId?: string },
      templateDir: string,
      filePrefix: string,
    ) {
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

        fileMap[`${uuid}.template`] = strToU8(JSON.stringify(enriched, null, 2))

        manifestTemplates[uuid] = {
          name: entry.name,
          templateVersion: resolvedVersion,
          contentHash,
          createdTime: prevEntry?.createdTime ?? nowMs,
        }
      } catch {
        fileMap[`${uuid}.template`] = strToU8(resolvedContent)
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
      fileMap[`${uuid}.metadata`] = strToU8(JSON.stringify(metadata, null, 2))
      fileMap[`${uuid}.content`] = strToU8('{}')
    }

    for (const entry of customReg.templates) addEntry(entry, config.customDir, 'custom')
    for (const entry of debugReg.templates) addEntry(entry, config.debugDir, 'debug')

    const manifest: RmMethodsManifest = { exportedAt: nowMs, templates: manifestTemplates }
    fileMap['.manifest'] = strToU8(JSON.stringify(manifest, null, 2))

    const zipped = zipSync(fileMap)
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', 'attachment; filename="remarkable-rm-methods.zip"')
      .header('content-length', String(zipped.length))
      .send(Buffer.from(zipped))
  })
}
