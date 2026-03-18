/**
 * GET /api/device/backups — list available rm_methods backups.
 */

import type { FastifyInstance } from 'fastify'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../../config.ts'
import { countManifestUuids } from '../../lib/manifestUuids.ts'

export default function deviceBackupRoutes(app: FastifyInstance, config: ServerConfig) {
  app.get('/api/device/backups', async (_request, reply) => {
    if (!existsSync(config.rmMethodsBackupDir)) {
      return reply.send({ backups: [] })
    }

    const entries = readdirSync(config.rmMethodsBackupDir)
      .filter(d => d.startsWith('rm-methods_'))
      .map(d => {
        const dir = resolve(config.rmMethodsBackupDir, d)
        const stat = statSync(dir)
        if (!stat.isDirectory()) return null
        const manifestPath = resolve(dir, '.manifest')
        const templateCount = existsSync(manifestPath) ? countManifestUuids(manifestPath) : 0
        return {
          name: d,
          path: dir,
          created: stat.mtime.toISOString(),
          templateCount,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.created.localeCompare(a!.created))

    return reply.send({ backups: entries })
  })
}
