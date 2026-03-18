/**
 * GET /api/export-templates — zip official + custom + debug templates
 * GET /api/export-rm-methods — zip in rm_methods UUID format
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import type { ServerConfig } from '../config.ts'
import { resolveStringConstants } from '../../src/lib/customTemplates.ts'
import { buildRmMethodsDist, writeRmMethodsDist } from '../lib/buildRmMethodsDist.ts'

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
    const result = buildRmMethodsDist(config)

    // Write to disk so deploy-methods can use it
    writeRmMethodsDist(config, result)

    // Build ZIP from the file map
    const fileMap: Record<string, Uint8Array> = {}
    for (const [name, content] of Object.entries(result.files)) {
      fileMap[name] = strToU8(content)
    }

    const zipped = zipSync(fileMap)
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', 'attachment; filename="remarkable-rm-methods.zip"')
      .header('content-length', String(zipped.length))
      .send(Buffer.from(zipped))
  })
}
