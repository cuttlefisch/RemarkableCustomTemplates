/**
 * Device rollback operations.
 *
 * Restores a device to a previous template state by removing orphaned templates,
 * pushing backup files, and updating manifests.
 *
 * Routes:
 * - `POST /api/devices/:id/rollback-methods`  -- revert to the most recent timestamped
 *   rm_methods backup. Removes templates added since the backup and restores backed-up files.
 * - `POST /api/devices/:id/rollback-original` -- restore the device to its pre-app pristine
 *   state (captured on first deploy). Removes all app-deployed templates.
 * - `POST /api/devices/:id/rollback-classic`  -- restore the most recent tar backup on the
 *   device's read-only filesystem (classic deploy format).
 *
 * Methods and original rollbacks stream NDJSON progress; classic rollback returns a single response.
 *
 * @module
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../../config.ts'
import { resolveDevicePaths } from '../../config.ts'
import { connect, exec } from '../../lib/ssh.ts'
import { getSftp, pushDirectory, removeFiles } from '../../lib/sftp.ts'
import { readManifestUuids } from '../../lib/manifestUuids.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import type { RmMethodsManifest } from '../../../src/lib/rmMethods.ts'
import { createNdjsonStream } from '../../lib/ndjsonStream.ts'
import { readDevice } from '../../lib/deviceStore.ts'
import {
  RM_METHODS_PATH,
  readDeviceManifest,
  writeDeviceManifest,
  removeDeviceManifest,
  parseManifestUuids,
  mergeDeployedUuids,
} from '../../lib/deviceManifest.ts'

/**
 * Registers device rollback routes on the given Fastify instance.
 *
 * @param app - Fastify instance to register routes on
 * @param config - Resolved server configuration with backup directory paths
 */
export default function deviceRollbackRoutes(app: FastifyInstance, config: ServerConfig) {
  // POST /api/devices/:id/rollback-methods
  app.post<{ Params: { id: string } }>('/api/devices/:id/rollback-methods', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const devicePaths = resolveDevicePaths(config, id)

    // Validate backup existence before starting stream
    const backupDirs = existsSync(devicePaths.backupDir)
      ? readdirSync(devicePaths.backupDir)
        .filter(d => d.startsWith('rm-methods_'))
        .map(d => resolve(devicePaths.backupDir, d))
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

    const stream = createNdjsonStream(reply)

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      const steps: string[] = []
      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      const deviceManifest = await readDeviceManifest(sftp)
      const deviceUuids = deviceManifest ? parseManifestUuids(JSON.stringify(deviceManifest)) : []
      const localUuids = existsSync(devicePaths.deployedManifest)
        ? readManifestUuids(devicePaths.deployedManifest)
        : []
      const allCurrentUuids = mergeDeployedUuids(localUuids, deviceUuids)

      const backupUuids = new Set(readManifestUuids(latestManifest))
      const orphans = allCurrentUuids.filter(uuid => !backupUuids.has(uuid))
      if (orphans.length > 0) {
        const filesToRemove = orphans.flatMap(uuid => [`${uuid}.template`, `${uuid}.metadata`, `${uuid}.content`])
        await removeFiles(sftp, RM_METHODS_PATH, filesToRemove, (cur, tot) => {
          stream.progress('Removing orphaned templates', cur, tot)
        })
        steps.push(`Removed ${orphans.length} templates added since backup`)
      }

      const pushed = await pushDirectory(sftp, latest, RM_METHODS_PATH, f => f !== '.manifest', (cur, tot) => {
        stream.progress('Restoring backup files', cur, tot)
      })
      steps.push(`Restored ${pushed.length} files from backup`)

      // Write device manifest first, then local cache
      let backupManifestContent: RmMethodsManifest
      try {
        backupManifestContent = JSON.parse(readFileSync(latestManifest, 'utf8')) as RmMethodsManifest
      } catch (err) {
        stream.error(`Backup manifest is corrupt: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
      await writeDeviceManifest(sftp, backupManifestContent)
      copyFileSync(latestManifest, devicePaths.deployedManifest)

      stream.progress('Restarting device UI...')
      await exec(client, 'systemctl restart xochitl')
      steps.push('Restarted xochitl')

      stream.done({ steps })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      stream.error(`Rollback failed: ${formatted.message}`, formatted.hint, formatted.rawError)
    } finally {
      client?.end()
    }
  })

  // POST /api/devices/:id/rollback-original
  app.post<{ Params: { id: string } }>('/api/devices/:id/rollback-original', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const devicePaths = resolveDevicePaths(config, id)

    if (!existsSync(devicePaths.originalBackup)) {
      return reply.status(400).send({ error: 'No original backup found. Deploy at least once first.' })
    }

    const originalManifestPath = resolve(devicePaths.originalBackup, '.manifest')
    if (!existsSync(originalManifestPath)) {
      return reply.status(400).send({ error: 'Original backup manifest is missing.' })
    }

    const stream = createNdjsonStream(reply)

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      const steps: string[] = []
      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      // Determine what's currently on the device
      const deviceManifest = await readDeviceManifest(sftp)
      const deviceUuids = deviceManifest ? parseManifestUuids(JSON.stringify(deviceManifest)) : []
      const localUuids = existsSync(devicePaths.deployedManifest)
        ? readManifestUuids(devicePaths.deployedManifest)
        : []
      const allCurrentUuids = mergeDeployedUuids(localUuids, deviceUuids)

      // Determine what was in the original state
      const originalUuids = new Set(readManifestUuids(originalManifestPath))

      // Remove templates that weren't in the original state (orphans)
      const orphans = allCurrentUuids.filter(uuid => !originalUuids.has(uuid))
      if (orphans.length > 0) {
        const filesToRemove = orphans.flatMap(uuid => [`${uuid}.template`, `${uuid}.metadata`, `${uuid}.content`])
        await removeFiles(sftp, RM_METHODS_PATH, filesToRemove, (cur, tot) => {
          stream.progress('Removing templates added since original state', cur, tot)
        })
        steps.push(`Removed ${orphans.length} templates added since original state`)
      }

      // Restore original files if any existed
      if (originalUuids.size > 0) {
        const pushed = await pushDirectory(sftp, devicePaths.originalBackup, RM_METHODS_PATH, f => f !== '.manifest', (cur, tot) => {
          stream.progress('Restoring original templates', cur, tot)
        })
        steps.push(`Restored ${pushed.length} original template files`)
      }

      // Update manifest — device first, then local cache
      if (originalUuids.size > 0) {
        let originalManifestContent: RmMethodsManifest
        try {
          originalManifestContent = JSON.parse(readFileSync(originalManifestPath, 'utf8')) as RmMethodsManifest
        } catch (err) {
          stream.error(`Original manifest is corrupt: ${err instanceof Error ? err.message : String(err)}`)
          return
        }
        await writeDeviceManifest(sftp, originalManifestContent)
      } else {
        try {
          await removeDeviceManifest(sftp)
        } catch { /* may not exist */ }
      }
      copyFileSync(originalManifestPath, devicePaths.deployedManifest)

      stream.progress('Restarting device UI...')
      await exec(client, 'systemctl restart xochitl')
      steps.push('Restarted xochitl')

      stream.done({ steps })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      stream.error(`Rollback failed: ${formatted.message}`, formatted.hint, formatted.rawError)
    } finally {
      client?.end()
    }
  })

  // POST /api/devices/:id/rollback-classic
  app.post<{ Params: { id: string } }>('/api/devices/:id/rollback-classic', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      client = await connect(deviceConfig)
      const result = await exec(client, `latest=$(ls -t /home/root/template-backups/templates_*.tar.gz 2>/dev/null | head -n 1); if [ -z "$latest" ]; then echo 'NO_BACKUPS'; exit 1; fi; echo "$latest"`)

      if (result.stdout.trim() === 'NO_BACKUPS' || result.code !== 0) {
        return reply.status(400).send({ error: 'No backups found on device.' })
      }

      const latestBackup = result.stdout.trim()
      await exec(client, `mount -o remount,rw / && tar xzf "${latestBackup}" -C /usr/share/remarkable && mount -o remount,ro / && systemctl restart xochitl`)

      return reply.send({ ok: true, restoredFrom: latestBackup })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Rollback failed: ${formatted.message}`, hint: formatted.hint, rawError: formatted.rawError })
    } finally {
      client?.end()
    }
  })
}
