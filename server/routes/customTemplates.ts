/**
 * Custom templates CRUD: POST/PUT/PATCH/DELETE /api/custom-templates
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../config.ts'
import { assertWithin } from '../lib/pathSecurity.ts'

function readRegistry(config: ServerConfig): { templates: unknown[] } {
  try {
    return JSON.parse(readFileSync(config.customRegistry, 'utf8')) as { templates: unknown[] }
  } catch {
    return { templates: [] }
  }
}

export default function customTemplateRoutes(app: FastifyInstance, config: ServerConfig) {
  // POST /api/custom-templates — create new template
  app.post('/api/custom-templates', async (request, reply) => {
    try {
      const body = request.body as {
        filename: string
        content: string
        entry: unknown
      }
      mkdirSync(config.customDir, { recursive: true })
      const filePath = resolve(config.customDir, `${body.filename}.template`)
      assertWithin(config.customDir, filePath)
      writeFileSync(filePath, body.content, 'utf8')

      const registry = readRegistry(config)
      registry.templates.push(body.entry)
      writeFileSync(config.customRegistry, JSON.stringify(registry, null, 2), 'utf8')

      return reply.status(201).send({ ok: true })
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })

  // PUT /api/custom-templates/:slug — update existing template
  app.put('/api/custom-templates/:slug', async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string }
      const filename = decodeURIComponent(slug)
      const body = request.body as {
        content: string
        entry?: unknown
      }
      const filePath = resolve(config.customDir, `${filename}.template`)
      assertWithin(config.customDir, filePath)
      writeFileSync(filePath, body.content, 'utf8')

      if (body.entry) {
        const registry = readRegistry(config)
        registry.templates = (registry.templates as Array<{ filename: string; rmMethodsId?: string }>).map(e => {
          if (e.filename !== `custom/${filename}`) return e
          const incoming = body.entry as Record<string, unknown>
          if (e.rmMethodsId && !incoming.rmMethodsId) {
            return { ...incoming, rmMethodsId: e.rmMethodsId }
          }
          return body.entry
        })
        writeFileSync(config.customRegistry, JSON.stringify(registry, null, 2), 'utf8')
      }

      return reply.send({ ok: true })
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })

  // PATCH /api/custom-templates/:slug — rename + update existing template
  app.patch('/api/custom-templates/:slug', async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string }
      const oldSlug = decodeURIComponent(slug)
      const body = request.body as {
        newSlug: string
        newName: string
        content: string
      }
      const { newSlug, newName, content } = body
      mkdirSync(config.customDir, { recursive: true })
      const newPath = resolve(config.customDir, `${newSlug}.template`)
      assertWithin(config.customDir, newPath)
      writeFileSync(newPath, content, 'utf8')
      if (newSlug !== oldSlug) {
        const oldPath = resolve(config.customDir, `${oldSlug}.template`)
        assertWithin(config.customDir, oldPath)
        if (existsSync(oldPath)) unlinkSync(oldPath)
      }
      const registry = readRegistry(config)
      registry.templates = (registry.templates as Array<{ filename: string; name: string }>).map(e =>
        e.filename === `custom/${oldSlug}`
          ? { ...e, name: newName, filename: `custom/${newSlug}` }
          : e,
      )
      writeFileSync(config.customRegistry, JSON.stringify(registry, null, 2), 'utf8')
      return reply.send({ ok: true })
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })

  // DELETE /api/custom-templates/:slug — delete existing template
  app.delete('/api/custom-templates/:slug', async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string }
      const filename = decodeURIComponent(slug)
      const filePath = resolve(config.customDir, `${filename}.template`)
      assertWithin(config.customDir, filePath)
      if (existsSync(filePath)) unlinkSync(filePath)
      const registry = readRegistry(config)
      registry.templates = (registry.templates as Array<{ filename: string }>).filter(
        e => e.filename !== `custom/${filename}`,
      )
      writeFileSync(config.customRegistry, JSON.stringify(registry, null, 2), 'utf8')
      return reply.send({ ok: true })
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })
}
