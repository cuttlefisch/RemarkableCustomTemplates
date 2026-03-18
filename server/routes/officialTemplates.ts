/**
 * POST /api/save-official-templates — write files to the official templates dir.
 */

import type { FastifyInstance } from 'fastify'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../config.ts'
import { assertWithin } from '../lib/pathSecurity.ts'

export default function officialTemplateRoutes(app: FastifyInstance, config: ServerConfig) {
  app.post('/api/save-official-templates', async (request, reply) => {
    try {
      const body = request.body as {
        files: Array<{ name: string; content: string }>
      }
      if (!body.files.some(f => f.name === 'templates.json')) {
        return reply.status(400).send({ error: 'templates.json must be included' })
      }
      mkdirSync(config.officialDir, { recursive: true })
      for (const { name, content } of body.files) {
        const filePath = resolve(config.officialDir, name)
        assertWithin(config.officialDir, filePath)
        writeFileSync(filePath, content, 'utf8')
      }
      return reply.send({ ok: true, count: body.files.length })
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })
}
