/**
 * GET /api/export-templates — zip official + custom + debug templates
 * GET /api/export-rm-methods — zip in rm_methods UUID format
 * GET /api/export-template/:uuid — export single template by rmMethodsId
 * GET /api/export-template-by-name/:slug — export single template by filename slug
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
  app.get('/api/export-templates', async (request, reply) => {
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
        } catch (err) {
          request.log.warn(`[export] Failed to sync categories from "${entry.filename}": ${err instanceof Error ? err.message : String(err)}`)
        }
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

  // GET /api/export-template/:uuid — export single template by rmMethodsId
  app.get<{ Params: { uuid: string } }>('/api/export-template/:uuid', async (request, reply) => {
    const { uuid } = request.params
    const result = buildRmMethodsDist(config)

    // Filter to just this template's files
    const prefix = `${uuid}.`
    const filtered: Record<string, Uint8Array> = {}
    for (const [name, content] of Object.entries(result.files)) {
      if (name.startsWith(prefix)) {
        filtered[name] = strToU8(content)
      }
    }

    if (Object.keys(filtered).length === 0) {
      return reply.status(404).send({ error: `Template ${uuid} not found in build output` })
    }

    const templateName = result.manifest.templates[uuid]?.name ?? uuid
    const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const zipped = zipSync(filtered)
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${safeName}.rm-methods.zip"`)
      .header('content-length', String(zipped.length))
      .send(Buffer.from(zipped))
  })

  // GET /api/export-template-by-name/:slug — export single template by filename slug
  // Slug is the short name (e.g. "P My Template"), URL-encoded
  app.get<{ Params: { slug: string } }>('/api/export-template-by-name/:slug', async (request, reply) => {
    const slug = decodeURIComponent(request.params.slug)

    // Build all (assigns UUIDs to entries that don't have one yet)
    const result = buildRmMethodsDist(config)

    // Look up the UUID for this template slug in the registries
    type RegEntry = { filename: string; rmMethodsId?: string }
    let matchedUuid: string | undefined
    for (const regPath of [config.customRegistry, config.debugRegistry, config.samplesRegistry]) {
      try {
        const reg = JSON.parse(readFileSync(regPath, 'utf8')) as { templates: RegEntry[] }
        const entry = reg.templates.find(e => {
          const shortName = e.filename.replace(/^(custom|debug|samples)\//, '')
          return shortName === slug
        })
        if (entry?.rmMethodsId) {
          matchedUuid = entry.rmMethodsId
          break
        }
      } catch { /* registry not found */ }
    }

    if (!matchedUuid) {
      return reply.status(404).send({ error: `Template "${slug}" not found in registries` })
    }

    // Filter to just this template's files
    const prefix = `${matchedUuid}.`
    const filtered: Record<string, Uint8Array> = {}
    for (const [name, content] of Object.entries(result.files)) {
      if (name.startsWith(prefix)) {
        filtered[name] = strToU8(content)
      }
    }

    if (Object.keys(filtered).length === 0) {
      return reply.status(404).send({ error: `Template "${slug}" (${matchedUuid}) not found in build output` })
    }

    const templateName = result.manifest.templates[matchedUuid]?.name ?? slug
    const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const zipped = zipSync(filtered)
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${safeName}.rm-methods.zip"`)
      .header('content-length', String(zipped.length))
      .send(Buffer.from(zipped))
  })
}
