/**
 * Device backup listing route.
 *
 * Registers `GET /api/devices/:id/backups` which lists timestamped rm_methods backup
 * directories for a specific device. Each entry includes the backup name, creation time,
 * and template count (from the backup's `.manifest` file).
 *
 * Backups are created automatically during deploy and sorted newest-first.
 *
 * @module
 */

import type { FastifyInstance } from 'fastify'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../../config.ts'
import { resolveDevicePaths } from '../../config.ts'
import { countManifestUuids } from '../../lib/manifestUuids.ts'

/**
 * Registers the device backup listing route on the given Fastify instance.
 *
 * @param app - Fastify instance to register routes on
 * @param config - Resolved server configuration with backup directory paths
 */
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
