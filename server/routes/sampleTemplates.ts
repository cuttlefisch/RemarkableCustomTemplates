/**
 * Sample templates hide/restore API.
 * Hidden samples are stored in custom/hidden-samples.json.
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ServerConfig } from '../config.ts'

function readHidden(path: string): string[] {
  if (!existsSync(path)) return []
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeHidden(path: string, hidden: string[]): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(hidden, null, 2))
}

export default function sampleTemplateRoutes(app: FastifyInstance, config: ServerConfig) {
  app.get('/api/sample-templates/hidden', async () => {
    const hidden = readHidden(config.hiddenSamplesPath)
    return { hidden }
  })

  app.post('/api/sample-templates/hide', async (request, reply) => {
    const { filename } = request.body as { filename: string }
    if (!filename || typeof filename !== 'string') {
      return reply.status(400).send({ error: 'filename is required' })
    }
    const hidden = readHidden(config.hiddenSamplesPath)
    if (!hidden.includes(filename)) {
      hidden.push(filename)
      writeHidden(config.hiddenSamplesPath, hidden)
    }
    return { ok: true, hidden }
  })

  app.post('/api/sample-templates/restore-all', async () => {
    const hidden = readHidden(config.hiddenSamplesPath)
    const count = hidden.length
    writeHidden(config.hiddenSamplesPath, [])
    return { ok: true, restored: count }
  })
}
