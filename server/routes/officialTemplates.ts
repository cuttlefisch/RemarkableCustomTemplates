/**
 * Official template import route.
 *
 * Registers `POST /api/save-official-templates` which writes an array of
 * template files (including `templates.json`) to the official templates directory.
 * Used by the frontend to persist templates fetched from a reMarkable device or
 * uploaded by the user. Requires `templates.json` in the payload for registry integrity.
 *
 * @module
 */

import type { FastifyInstance } from 'fastify'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../config.ts'
import { assertWithin } from '../lib/pathSecurity.ts'

/**
 * Registers the official template save route.
 *
 * Accepts `{ files: [{ name, content }] }` where at least one entry must be
 * `templates.json`. All files are written to `config.officialDir` with
 * path-traversal protection.
 *
 * @param app - Fastify instance to register routes on
 * @param config - Resolved server configuration with data directory paths
 */
export default function officialTemplateRoutes(app: FastifyInstance, config: ServerConfig) {
  app.post('/api/save-official-templates', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | null
      if (!body || !Array.isArray(body.files)) {
        return reply.status(400).send({ error: 'Request body must contain a files array' })
      }
      const files = body.files as Array<{ name: string; content: string }>
      if (!files.some(f => f.name === 'templates.json')) {
        return reply.status(400).send({ error: 'templates.json must be included' })
      }
      mkdirSync(config.officialDir, { recursive: true })
      for (const { name, content } of files) {
        const filePath = resolve(config.officialDir, name)
        assertWithin(config.officialDir, filePath)
        writeFileSync(filePath, content, 'utf8')
      }
      return reply.send({ ok: true, count: files.length })
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })
}
