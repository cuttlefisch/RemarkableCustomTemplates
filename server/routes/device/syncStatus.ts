/**
 * POST /api/devices/:id/sync-status — compare local build vs device manifest.
 */

import type { FastifyInstance } from 'fastify'
import type { ServerConfig } from '../../config.ts'
import { connect } from '../../lib/ssh.ts'
import { getSftp } from '../../lib/sftp.ts'
import { buildRmMethodsDist } from '../../lib/buildRmMethodsDist.ts'
import { buildClassicDist } from '../../lib/buildClassicDist.ts'
import { readDeviceManifest } from '../../lib/deviceManifest.ts'
import { readRemoteFile } from '../../lib/sftp.ts'
import { computeSyncStatus, computeClassicSyncStatus, type ClassicSyncResult } from '../../lib/syncStatus.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import { readDevice } from '../../lib/deviceStore.ts'

export default function deviceSyncStatusRoutes(app: FastifyInstance, config: ServerConfig) {
  app.post<{ Params: { id: string } }>('/api/devices/:id/sync-status', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    try {
      const buildResult = buildRmMethodsDist(config)

      const conn = await connect(deviceConfig)
      let deviceManifest
      let classic: ClassicSyncResult | null = null
      try {
        const sftp = await getSftp(conn)
        deviceManifest = await readDeviceManifest(sftp)

        try {
          const deviceClassicJson = await readRemoteFile(sftp, '/usr/share/remarkable/templates/templates.json')
          const deviceClassicRegistry = JSON.parse(deviceClassicJson) as { templates: { filename: string; name?: string }[] }
          const classicBuild = buildClassicDist(config)
          const localClassicRegistry = JSON.parse(classicBuild.files['templates.json'] as string) as { templates: { filename: string; name?: string }[] }
          classic = computeClassicSyncStatus(localClassicRegistry, deviceClassicRegistry)
        } catch {
          classic = null
        }
      } finally {
        conn.end()
      }

      const { summary, templates } = computeSyncStatus(buildResult.manifest, deviceManifest)

      return reply.send({
        ok: true,
        summary,
        templates,
        classic,
        checkedAt: new Date().toISOString(),
      })
    } catch (err) {
      const { message, hint } = formatSshError(err instanceof Error ? err : String(err))
      return reply.status(500).send({ error: message, hint })
    }
  })
}
