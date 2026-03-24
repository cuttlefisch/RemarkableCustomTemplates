/**
 * Template file serving routes.
 *
 * Registers `GET /templates/*` which serves `.template` and registry JSON files
 * from multiple source directories (official, custom, debug, samples, methods).
 *
 * For `GET /templates/templates.json`, returns a merged registry combining
 * debug, samples (minus hidden), methods, and official template entries.
 * All other paths resolve to the matching source directory with path-traversal
 * protection via {@link assertWithin}.
 *
 * @module
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../config.ts'
import { assertWithin } from '../lib/pathSecurity.ts'

/**
 * Registers the `GET /templates/*` route on the given Fastify instance.
 *
 * The wildcard path is matched against subdirectory prefixes (`custom/`, `debug/`,
 * `samples/`, `methods/`) to route to the correct data directory. The special path
 * `templates.json` returns the merged registry from all template sources.
 *
 * @param app - Fastify instance to register routes on
 * @param config - Resolved server configuration with data directory paths
 */
export default function templateRoutes(app: FastifyInstance, config: ServerConfig) {
  app.get('/templates/*', async (request, reply) => {
    const wildcard = (request.params as Record<string, string>)['*']
    if (!wildcard) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const filename = decodeURIComponent(wildcard)

    // Custom templates
    const customMatch = filename.match(/^custom\/(.+)$/)
    if (customMatch) {
      const customFile = customMatch[1]
      let customPath: string
      try {
        customPath = resolve(config.customDir, customFile)
        assertWithin(config.customDir, customPath)
      } catch {
        return reply.status(400).send({ error: 'Invalid path' })
      }
      if (!existsSync(customPath)) {
        return reply.status(404).send({ error: 'Not found' })
      }
      const ct = customFile.endsWith('.json') ? 'application/json' : 'application/octet-stream'
      return reply.type(ct).send(readFileSync(customPath))
    }

    // Debug templates
    const debugMatch = filename.match(/^debug\/(.+)$/)
    if (debugMatch) {
      const debugFile = debugMatch[1]
      let debugPath: string
      try {
        debugPath = resolve(config.debugDir, debugFile)
        assertWithin(config.debugDir, debugPath)
      } catch {
        return reply.status(400).send({ error: 'Invalid path' })
      }
      if (!existsSync(debugPath)) {
        return reply.status(404).send({ error: 'Not found' })
      }
      const ct = debugFile.endsWith('.json') ? 'application/json' : 'application/octet-stream'
      return reply.type(ct).send(readFileSync(debugPath))
    }

    // Samples templates
    const samplesMatch = filename.match(/^samples\/(.+)$/)
    if (samplesMatch) {
      const samplesFile = samplesMatch[1]
      let samplesPath: string
      try {
        samplesPath = resolve(config.samplesDir, samplesFile)
        assertWithin(config.samplesDir, samplesPath)
      } catch {
        return reply.status(400).send({ error: 'Invalid path' })
      }
      if (!existsSync(samplesPath)) {
        return reply.status(404).send({ error: 'Not found' })
      }
      const ct = samplesFile.endsWith('.json') ? 'application/json' : 'application/octet-stream'
      return reply.type(ct).send(readFileSync(samplesPath))
    }

    // Methods templates
    const methodsMatch = filename.match(/^methods\/(.+)$/)
    if (methodsMatch) {
      const methodsFile = methodsMatch[1]
      let methodsPath: string
      try {
        methodsPath = resolve(config.methodsDir, methodsFile)
        assertWithin(config.methodsDir, methodsPath)
      } catch {
        return reply.status(400).send({ error: 'Invalid path' })
      }
      if (!existsSync(methodsPath)) {
        return reply.status(404).send({ error: 'Not found' })
      }
      const ct = methodsFile.endsWith('.json') ? 'application/json' : 'application/octet-stream'
      return reply.type(ct).send(readFileSync(methodsPath))
    }

    // templates.json — merged registry
    if (filename === 'templates.json') {
      const debugTemplates = existsSync(config.debugRegistry)
        ? (JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as { templates: unknown[] }).templates
        : []

      // Samples: load registry and filter out hidden entries
      let samplesTemplates: unknown[] = []
      if (existsSync(config.samplesRegistry)) {
        const allSamples = (JSON.parse(readFileSync(config.samplesRegistry, 'utf8')) as { templates: Array<{ filename: string }> }).templates
        const hidden: string[] = existsSync(config.hiddenSamplesPath)
          ? JSON.parse(readFileSync(config.hiddenSamplesPath, 'utf8'))
          : []
        samplesTemplates = allSamples.filter(t => !hidden.includes(t.filename))
      }

      const methodsTemplates = existsSync(config.methodsRegistry)
        ? (JSON.parse(readFileSync(config.methodsRegistry, 'utf8')) as { templates: unknown[] }).templates
        : []
      const officialPath = resolve(config.officialDir, 'templates.json')
      const hasOfficial = existsSync(officialPath)
      const officialTemplates = hasOfficial
        ? (JSON.parse(readFileSync(officialPath, 'utf8')) as { templates: unknown[] }).templates
        : []
      const allTemplates = [...debugTemplates, ...samplesTemplates, ...methodsTemplates, ...officialTemplates]
      if (allTemplates.length > 0 || hasOfficial) {
        return reply.send({ templates: allTemplates })
      }
      return reply.status(404).send({ error: 'Not found' })
    }

    // Official template files
    let filePath: string
    try {
      filePath = resolve(config.officialDir, filename)
      assertWithin(config.officialDir, filePath)
    } catch {
      return reply.status(400).send({ error: 'Invalid path' })
    }

    if (existsSync(filePath)) {
      const ct = filename.endsWith('.json') ? 'application/json' : 'application/octet-stream'
      return reply.type(ct).send(readFileSync(filePath))
    }

    return reply.status(404).send({ error: 'Not found' })
  })
}
