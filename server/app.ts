/**
 * Fastify app factory — creates and configures the server.
 * Separated from index.ts for testability.
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from './config.ts'
import templateRoutes from './routes/templates.ts'
import customTemplateRoutes from './routes/customTemplates.ts'
import officialTemplateRoutes from './routes/officialTemplates.ts'
import exportRoutes from './routes/export.ts'
import backupRoutes from './routes/backup.ts'
import deviceConfigRoutes from './routes/device/config.ts'
import devicePullRoutes from './routes/device/pull.ts'
import deviceDeployRoutes from './routes/device/deploy.ts'
import deviceRollbackRoutes from './routes/device/rollback.ts'
import deviceBackupRoutes from './routes/device/backups.ts'

export async function createApp(config: ServerConfig) {
  const app = Fastify({
    logger: true,
    bodyLimit: 52428800, // 50MB for backup uploads
  })

  await app.register(cors, { origin: true })

  // Raw body handling for restore endpoint (receives ZIP binary)
  app.addContentTypeParser('application/zip', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  // Register API routes
  templateRoutes(app, config)
  customTemplateRoutes(app, config)
  officialTemplateRoutes(app, config)
  exportRoutes(app, config)
  backupRoutes(app, config)
  deviceConfigRoutes(app, config)
  devicePullRoutes(app, config)
  deviceDeployRoutes(app, config)
  deviceRollbackRoutes(app, config)
  deviceBackupRoutes(app, config)

  // In production, serve the built frontend
  if (config.production) {
    const distPath = resolve(config.dataDir, 'dist')
    if (existsSync(distPath)) {
      await app.register(fastifyStatic, {
        root: distPath,
        prefix: '/',
        wildcard: false,
      })

      // SPA fallback — serve index.html for non-API, non-template routes
      app.setNotFoundHandler(async (request, reply) => {
        const url = request.url
        if (url.startsWith('/api/') || url.startsWith('/templates/')) {
          return reply.status(404).send({ error: 'Not found' })
        }
        return reply.sendFile('index.html')
      })
    }
  }

  return app
}
