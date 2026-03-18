/**
 * GET /templates/* — serve template files from official, debug, and methods dirs.
 * Merges debug + methods + official registries for GET /templates/templates.json.
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../config.ts'
import { assertWithin } from '../lib/pathSecurity.ts'

export default function templateRoutes(app: FastifyInstance, config: ServerConfig) {
  app.get('/templates/*', async (request, reply) => {
    const wildcard = (request.params as Record<string, string>)['*']
    if (!wildcard) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const filename = decodeURIComponent(wildcard)

    // Skip custom/ — served by Vite's static middleware in dev, @fastify/static in prod
    if (filename.startsWith('custom/')) {
      return reply.status(404).send({ error: 'Not found' })
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
      const methodsTemplates = existsSync(config.methodsRegistry)
        ? (JSON.parse(readFileSync(config.methodsRegistry, 'utf8')) as { templates: unknown[] }).templates
        : []
      const officialPath = resolve(config.officialDir, 'templates.json')
      const hasOfficial = existsSync(officialPath)
      const officialTemplates = hasOfficial
        ? (JSON.parse(readFileSync(officialPath, 'utf8')) as { templates: unknown[] }).templates
        : []
      const allTemplates = [...debugTemplates, ...methodsTemplates, ...officialTemplates]
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
