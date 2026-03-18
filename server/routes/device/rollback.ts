/**
 * Device rollback operations.
 *
 * POST /api/device/rollback-methods    — revert to most recent rm_methods backup
 * POST /api/device/rollback-original   — remove all custom templates from device
 * POST /api/device/rollback-classic    — restore tar backup on device
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../../config.ts'
import { connect, exec, type DeviceConfig } from '../../lib/ssh.ts'
import { getSftp, pushDirectory, removeFiles } from '../../lib/sftp.ts'
import { readManifestUuids, diffManifestUuids } from '../../lib/manifestUuids.ts'
import { formatSshError } from '../../lib/sshErrors.ts'

const RM_METHODS_PATH = '/home/root/.local/share/remarkable/xochitl'

function readDeviceConfig(config: ServerConfig): DeviceConfig | null {
  try {
    return JSON.parse(readFileSync(config.deviceConfigPath, 'utf8')) as DeviceConfig
  } catch {
    return null
  }
}

export default function deviceRollbackRoutes(app: FastifyInstance, config: ServerConfig) {
  // POST /api/device/rollback-methods
  app.post('/api/device/rollback-methods', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    try {
      // Find latest timestamped backup
      const backupDirs = existsSync(config.rmMethodsBackupDir)
        ? readdirSync(config.rmMethodsBackupDir)
          .filter(d => d.startsWith('rm-methods_'))
          .map(d => resolve(config.rmMethodsBackupDir, d))
          .filter(d => statSync(d).isDirectory())
          .sort()
          .reverse()
        : []

      if (backupDirs.length === 0) {
        return reply.status(400).send({ error: 'No timestamped backups found. Use rollback-original to revert to pristine state.' })
      }

      const latest = backupDirs[0]
      const latestManifest = resolve(latest, '.manifest')
      if (!existsSync(latestManifest)) {
        return reply.status(400).send({ error: `Backup ${latest} has no manifest.` })
      }

      const steps: string[] = []
      const client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      // Remove templates added since backup
      if (existsSync(config.rmMethodsDeployedManifest)) {
        const removed = diffManifestUuids(config.rmMethodsDeployedManifest, latestManifest)
        if (removed.length > 0) {
          const filesToRemove = removed.flatMap(uuid => [`${uuid}.template`, `${uuid}.metadata`, `${uuid}.content`])
          await removeFiles(sftp, RM_METHODS_PATH, filesToRemove)
          steps.push(`Removed ${removed.length} templates added since backup`)
        }
      }

      // Push backup files
      const pushed = await pushDirectory(sftp, latest, RM_METHODS_PATH, f => f !== '.manifest')
      steps.push(`Restored ${pushed.length} files from backup`)

      // Update deployed manifest
      copyFileSync(latestManifest, config.rmMethodsDeployedManifest)

      // Restart
      await exec(client, 'systemctl restart xochitl')
      client.end()
      steps.push('Restarted xochitl')

      return reply.send({ ok: true, steps })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Rollback failed: ${formatted.message}`, hint: formatted.hint })
    }
  })

  // POST /api/device/rollback-original
  app.post('/api/device/rollback-original', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    if (!existsSync(config.rmMethodsOriginalBackup)) {
      return reply.status(400).send({ error: 'No original backup found. Deploy at least once first.' })
    }

    try {
      const steps: string[] = []
      const client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      // Remove all deployed templates
      if (existsSync(config.rmMethodsDeployedManifest)) {
        const uuids = readManifestUuids(config.rmMethodsDeployedManifest)
        if (uuids.length > 0) {
          const filesToRemove = uuids.flatMap(uuid => [`${uuid}.template`, `${uuid}.metadata`, `${uuid}.content`])
          await removeFiles(sftp, RM_METHODS_PATH, filesToRemove)
          steps.push(`Removed ${uuids.length} deployed templates`)
        }
      }

      // Copy original manifest to deployed
      const originalManifest = resolve(config.rmMethodsOriginalBackup, '.manifest')
      copyFileSync(originalManifest, config.rmMethodsDeployedManifest)

      // Restart
      await exec(client, 'systemctl restart xochitl')
      client.end()
      steps.push('Restarted xochitl')

      return reply.send({ ok: true, steps })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Rollback failed: ${formatted.message}`, hint: formatted.hint })
    }
  })

  // POST /api/device/rollback-classic
  app.post('/api/device/rollback-classic', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    try {
      const client = await connect(deviceConfig)
      const result = await exec(client, `latest=$(ls -t /home/root/template-backups/templates_*.tar.gz 2>/dev/null | head -n 1); if [ -z "$latest" ]; then echo 'NO_BACKUPS'; exit 1; fi; echo "$latest"`)

      if (result.stdout.trim() === 'NO_BACKUPS' || result.code !== 0) {
        client.end()
        return reply.status(400).send({ error: 'No backups found on device.' })
      }

      const latestBackup = result.stdout.trim()
      await exec(client, `mount -o remount,rw / && tar xzf "${latestBackup}" -C /usr/share/remarkable && mount -o remount,ro / && systemctl restart xochitl`)
      client.end()

      return reply.send({ ok: true, restoredFrom: latestBackup })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Rollback failed: ${formatted.message}`, hint: formatted.hint })
    }
  })
}
