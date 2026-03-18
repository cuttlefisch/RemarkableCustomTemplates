/**
 * POST /api/device/sync-status — compare local build vs device manifest.
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import type { ServerConfig } from '../../config.ts'
import { connect, type DeviceConfig } from '../../lib/ssh.ts'
import { getSftp } from '../../lib/sftp.ts'
import { buildRmMethodsDist } from '../../lib/buildRmMethodsDist.ts'
import { readDeviceManifest } from '../../lib/deviceManifest.ts'
import { computeSyncStatus } from '../../lib/syncStatus.ts'
import { formatSshError } from '../../lib/sshErrors.ts'

function readDeviceConfig(config: ServerConfig): DeviceConfig | null {
  try {
    return JSON.parse(readFileSync(config.deviceConfigPath, 'utf8')) as DeviceConfig
  } catch {
    return null
  }
}

export default function deviceSyncStatusRoutes(app: FastifyInstance, config: ServerConfig) {
  app.post('/api/device/sync-status', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    try {
      // Build local manifest (fresh content hashes, no disk write)
      const buildResult = buildRmMethodsDist(config)

      // Read device manifest via SSH
      const conn = await connect(deviceConfig)
      let deviceManifest
      try {
        const sftp = await getSftp(conn)
        deviceManifest = await readDeviceManifest(sftp)
      } finally {
        conn.end()
      }

      const { summary, templates } = computeSyncStatus(buildResult.manifest, deviceManifest)

      return reply.send({
        ok: true,
        summary,
        templates,
        checkedAt: new Date().toISOString(),
      })
    } catch (err) {
      const { message, hint } = formatSshError(err instanceof Error ? err : String(err))
      return reply.status(500).send({ error: message, hint })
    }
  })
}
