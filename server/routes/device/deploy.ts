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
import { getSftp, pushDirectory, removeFiles, pullFile } from '../../lib/sftp.ts'
import { readManifestUuids } from '../../lib/manifestUuids.ts'
import { buildRmMethodsDist, writeRmMethodsDist } from '../../lib/buildRmMethodsDist.ts'
import { buildClassicDist, writeClassicDist } from '../../lib/buildClassicDist.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import {
  RM_METHODS_PATH,
  readDeviceManifest,
  writeDeviceManifest,
  parseManifestUuids,
  mergeDeployedUuids,
} from '../../lib/deviceManifest.ts'

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

    try {
      const steps: string[] = []

      // Auto-build rm-methods-dist from custom + debug templates
      const buildResult = buildRmMethodsDist(config)
      writeRmMethodsDist(config, buildResult)
      steps.push(`Built ${buildResult.templateCount} templates`)

      const distDir = config.rmMethodsDistDir
      const manifestPath = resolve(distDir, '.manifest')

      // Single SSH connection for entire operation
      const client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      // Read device manifest for orphan tracking
      const deviceManifest = await readDeviceManifest(sftp)
      const deviceUuids = deviceManifest ? parseManifestUuids(JSON.stringify(deviceManifest)) : []

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
        const localUuids = readManifestUuids(config.rmMethodsDeployedManifest)
        const allUuids = mergeDeployedUuids(localUuids, deviceUuids)
        for (const uuid of allUuids) {
          for (const ext of ['.template', '.metadata', '.content']) {
            try {
              await pullFile(sftp, `${RM_METHODS_PATH}/${uuid}${ext}`, resolve(backupDir, `${uuid}${ext}`))
            } catch { /* file may not exist */ }
          }
        }
        steps.push(`Backed up ${allUuids.length} templates`)
      }

      // Remove orphaned templates (merged from local + device manifests)
      const localUuids = readManifestUuids(config.rmMethodsDeployedManifest)
      const allPreviousUuids = mergeDeployedUuids(localUuids, deviceUuids)
      const newUuids = new Set(readManifestUuids(manifestPath))
      const orphans = allPreviousUuids.filter(uuid => !newUuids.has(uuid))
      if (orphans.length > 0) {
        const filesToRemove = orphans.flatMap(uuid => [`${uuid}.template`, `${uuid}.metadata`, `${uuid}.content`])
        await removeFiles(sftp, RM_METHODS_PATH, filesToRemove)
        steps.push(`Removed ${orphans.length} orphaned templates`)
      }

      // Push new templates
      const pushed = await pushDirectory(sftp, distDir, RM_METHODS_PATH, f => f !== '.manifest')
      steps.push(`Pushed ${pushed.length} files`)

      // Update deployed manifest (local cache + device)
      copyFileSync(manifestPath, config.rmMethodsDeployedManifest)
      await writeDeviceManifest(sftp, buildResult.manifest)

      // Restart xochitl
      await exec(client, 'systemctl restart xochitl')
      client.end()
      steps.push('Restarted xochitl')

      return reply.send({ ok: true, steps })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Deploy failed: ${formatted.message}`, hint: formatted.hint })
    }
  })

  // POST /api/device/deploy-classic
  app.post('/api/device/deploy-classic', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    try {
      const steps: string[] = []

      // Auto-build dist-deploy from official + custom + debug templates
      const buildResult = buildClassicDist(config)
      writeClassicDist(config, buildResult)
      steps.push(`Built ${buildResult.templateCount} templates`)

      const distDir = config.classicDistDir

      const client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      // Backup on device
      await exec(client, `mount -o remount,rw / && mkdir -p /home/root/template-backups && timestamp=$(date +%Y%m%d_%H%M%S) && tar czf /home/root/template-backups/templates_\${timestamp}.tar.gz -C /usr/share/remarkable templates`)
      steps.push('Created backup on device')

      const pushed = await pushDirectory(sftp, distDir, TEMPLATES_PATH)
      steps.push(`Pushed ${pushed.length} files`)

      // Remount ro and restart
      await exec(client, 'mount -o remount,ro / && systemctl restart xochitl')
      client.end()
      steps.push('Restarted xochitl')

      return reply.send({ ok: true, steps })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Deploy failed: ${formatted.message}`, hint: formatted.hint })
    }
  })
}
