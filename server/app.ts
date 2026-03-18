/**
 * Fastify app factory — creates and configures the server.
 * Separated from index.ts for testability.
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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
import deviceRemoveAllRoutes from './routes/device/removeAll.ts'
import deviceSyncStatusRoutes from './routes/device/syncStatus.ts'

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
  deviceRemoveAllRoutes(app, config)
  deviceSyncStatusRoutes(app, config)

  // In production, serve the built frontend (dist/ is at the app root, not in dataDir)
  if (config.production) {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const distPath = resolve(__dirname, '..', 'dist')
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
