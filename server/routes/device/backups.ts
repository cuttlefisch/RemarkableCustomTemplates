/**
 * GET /api/devices/:id/backups — list available rm_methods backups for a device.
 */

import type { FastifyInstance } from 'fastify'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../../config.ts'
import { resolveDevicePaths } from '../../config.ts'
import { countManifestUuids } from '../../lib/manifestUuids.ts'

export default function deviceBackupRoutes(app: FastifyInstance, config: ServerConfig) {
  app.get<{ Params: { id: string } }>('/api/devices/:id/backups', async (request, reply) => {
    const { id } = request.params
    const devicePaths = resolveDevicePaths(config, id)

    if (!existsSync(devicePaths.backupDir)) {
      return reply.send({ backups: [] })
    }

    const entries = readdirSync(devicePaths.backupDir)
      .filter(d => d.startsWith('rm-methods_'))
      .map(d => {
        const dir = resolve(devicePaths.backupDir, d)
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
