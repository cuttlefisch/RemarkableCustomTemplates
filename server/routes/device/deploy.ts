/**
 * Device deploy operations — replaces `make deploy-rm-methods` and `make deploy`.
 *
 * POST /api/device/deploy-methods   — deploy rm_methods templates
 * POST /api/device/deploy-classic   — classic deploy (mount rw, push, restart)
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../../config.ts'
import { connect, exec, type DeviceConfig } from '../../lib/ssh.ts'
import { getSftp, pushDirectory, removeFiles } from '../../lib/sftp.ts'
import { readManifestUuids, diffManifestUuids } from '../../lib/manifestUuids.ts'

const RM_METHODS_PATH = '/home/root/.local/share/remarkable/xochitl'
const TEMPLATES_PATH = '/usr/share/remarkable/templates'

function readDeviceConfig(config: ServerConfig): DeviceConfig | null {
  try {
    return JSON.parse(readFileSync(config.deviceConfigPath, 'utf8')) as DeviceConfig
  } catch {
    return null
  }
}

export default function deviceDeployRoutes(app: FastifyInstance, config: ServerConfig) {
  // POST /api/device/deploy-methods
  app.post('/api/device/deploy-methods', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const distDir = config.rmMethodsDistDir
    const manifestPath = resolve(distDir, '.manifest')
    if (!existsSync(distDir) || !existsSync(manifestPath)) {
      return reply.status(400).send({ error: 'rm-methods-dist/ not found. Build first.' })
    }

    try {
      const steps: string[] = []

      // Backup current deployment
      mkdirSync(config.rmMethodsBackupDir, { recursive: true })
      if (!existsSync(config.rmMethodsOriginalBackup)) {
        mkdirSync(config.rmMethodsOriginalBackup, { recursive: true })
        writeFileSync(resolve(config.rmMethodsOriginalBackup, '.manifest'), '{"exportedAt":"0","templates":{}}', 'utf8')
        steps.push('Captured pristine device state')
      }

      if (existsSync(config.rmMethodsDeployedManifest)) {
        const ts = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15)
        const backupDir = resolve(config.rmMethodsBackupDir, `rm-methods_${ts}`)
        mkdirSync(backupDir, { recursive: true })
        copyFileSync(config.rmMethodsDeployedManifest, resolve(backupDir, '.manifest'))

        // Pull deployed files for backup
        const client = await connect(deviceConfig)
        const sftp = await getSftp(client)
        const uuids = readManifestUuids(config.rmMethodsDeployedManifest)
        for (const uuid of uuids) {
          for (const ext of ['.template', '.metadata', '.content']) {
            try {
              const { pullFile: pullOneFile } = await import('../../lib/sftp.ts')
              await pullOneFile(sftp, `${RM_METHODS_PATH}/${uuid}${ext}`, resolve(backupDir, `${uuid}${ext}`))
            } catch { /* file may not exist */ }
          }
        }
        client.end()
        steps.push(`Backed up ${uuids.length} templates`)
      }

      // Remove orphaned templates
      if (existsSync(config.rmMethodsDeployedManifest)) {
        const removed = diffManifestUuids(config.rmMethodsDeployedManifest, manifestPath)
        if (removed.length > 0) {
          const client = await connect(deviceConfig)
          const sftp = await getSftp(client)
          const filesToRemove = removed.flatMap(uuid => [`${uuid}.template`, `${uuid}.metadata`, `${uuid}.content`])
          await removeFiles(sftp, RM_METHODS_PATH, filesToRemove)
          client.end()
          steps.push(`Removed ${removed.length} orphaned templates`)
        }
      }

      // Push new templates
      const client = await connect(deviceConfig)
      const sftp = await getSftp(client)
      const pushed = await pushDirectory(sftp, distDir, RM_METHODS_PATH, f => f !== '.manifest')
      steps.push(`Pushed ${pushed.length} files`)

      // Update deployed manifest
      copyFileSync(manifestPath, config.rmMethodsDeployedManifest)

      // Restart xochitl
      await exec(client, 'systemctl restart xochitl')
      client.end()
      steps.push('Restarted xochitl')

      return reply.send({ ok: true, steps })
    } catch (e) {
      return reply.status(500).send({ error: `Deploy failed: ${String(e)}` })
    }
  })

  // POST /api/device/deploy-classic
  app.post('/api/device/deploy-classic', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    try {
      const client = await connect(deviceConfig)
      const sftp = await getSftp(client)
      const steps: string[] = []

      // Backup on device
      await exec(client, `mount -o remount,rw / && mkdir -p /home/root/template-backups && timestamp=$(date +%Y%m%d_%H%M%S) && tar czf /home/root/template-backups/templates_\${timestamp}.tar.gz -C /usr/share/remarkable templates`)
      steps.push('Created backup on device')

      // Push templates
      const distDir = resolve(config.dataDir, 'dist-deploy')
      if (!existsSync(distDir)) {
        client.end()
        return reply.status(400).send({ error: 'dist-deploy/ not found. Build first.' })
      }

      const pushed = await pushDirectory(sftp, distDir, TEMPLATES_PATH)
      steps.push(`Pushed ${pushed.length} files`)

      // Remount ro and restart
      await exec(client, 'mount -o remount,ro / && systemctl restart xochitl')
      client.end()
      steps.push('Restarted xochitl')

      return reply.send({ ok: true, steps })
    } catch (e) {
      return reply.status(500).send({ error: `Deploy failed: ${String(e)}` })
    }
  })
}
