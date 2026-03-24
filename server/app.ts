/**
 * Fastify application factory.
 *
 * Creates and fully configures a Fastify instance with CORS, body parsers,
 * all API route modules, icon backfill, and (in production) static file serving
 * with SPA fallback. Separated from `index.ts` so the app can be instantiated
 * without binding to a port -- used by tests via `app.inject()`.
 *
 * @module
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
import deviceXoviRoutes from './routes/device/xovi.ts'
import sampleTemplateRoutes from './routes/sampleTemplates.ts'
import notebookRoutes from './routes/notebook.ts'
import notebookDraftRoutes from './routes/notebookDrafts.ts'
import builtinNotebookRoutes from './routes/builtinNotebooks.ts'
import { backfillAllIcons } from './lib/backfillIcons.ts'

/**
 * Creates a fully configured Fastify application instance.
 *
 * Registers all API route modules, sets up CORS and binary body parsers (for ZIP
 * uploads), runs icon backfill for registries missing `iconData`, and in production
 * mode serves the Vite-built frontend with SPA fallback routing.
 *
 * @param config - Resolved server configuration from {@link resolveConfig}
 * @returns A ready-to-listen Fastify instance
 */
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
  deviceXoviRoutes(app, config)
  sampleTemplateRoutes(app, config)
  notebookRoutes(app, config)
  notebookDraftRoutes(app, config)
  builtinNotebookRoutes(app, config)

  // Backfill iconData for any registry entries missing it
  backfillAllIcons(config)

  // In production, serve the built frontend
  if (config.production) {
    const distPath = config.frontendDistDir
      ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
    if (existsSync(distPath)) {
      await app.register(fastifyStatic, {
        root: distPath,
        prefix: '/',
        wildcard: false,
        globIgnore: ['templates/**'],
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
