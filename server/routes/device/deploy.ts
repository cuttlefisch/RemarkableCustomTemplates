/**
 * Device deploy operations.
 *
 * POST /api/devices/:id/deploy-methods   — deploy rm_methods templates (optionally selective)
 * POST /api/devices/:id/deploy-classic   — classic deploy (mount rw, push, restart)
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ServerConfig } from '../../config.ts'
import { resolveDevicePaths } from '../../config.ts'
import { connect, exec } from '../../lib/ssh.ts'
import { getSftp, pushDirectory, removeFiles, pullFile } from '../../lib/sftp.ts'
import { readManifestUuids } from '../../lib/manifestUuids.ts'
import { buildRmMethodsDist, writeRmMethodsDist } from '../../lib/buildRmMethodsDist.ts'
import { buildClassicDist, writeClassicDist } from '../../lib/buildClassicDist.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import { createNdjsonStream } from '../../lib/ndjsonStream.ts'
import { readDevice } from '../../lib/deviceStore.ts'
import type { RmMethodsManifest } from '../../../src/lib/rmMethods.ts'
import {
  RM_METHODS_PATH,
  readDeviceManifest,
  writeDeviceManifest,
  parseManifestUuids,
  mergeDeployedUuids,
} from '../../lib/deviceManifest.ts'

const TEMPLATES_PATH = '/usr/share/remarkable/templates'

export default function deviceDeployRoutes(app: FastifyInstance, config: ServerConfig) {
  // POST /api/devices/:id/deploy-methods
  app.post<{ Params: { id: string } }>('/api/devices/:id/deploy-methods', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const body = request.body as { templateIds?: string[] } | undefined
    const selectiveIds = body?.templateIds
    const isSelective = Array.isArray(selectiveIds) && selectiveIds.length > 0

    // Empty selective array means user explicitly selected nothing — don't deploy
    if (Array.isArray(selectiveIds) && selectiveIds.length === 0) {
      return reply.status(400).send({ error: 'No templates selected for deploy' })
    }

    const devicePaths = resolveDevicePaths(config, id)
    const stream = createNdjsonStream(reply)

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      const steps: string[] = []

      // Auto-build rm-methods-dist from custom + debug templates
      stream.progress('Building templates...')
      const buildResult = buildRmMethodsDist(config)
      writeRmMethodsDist(config, buildResult)
      steps.push(`Built ${buildResult.templateCount} templates`)

      const distDir = config.rmMethodsDistDir
      const manifestPath = resolve(distDir, '.manifest')

      // Single SSH connection for entire operation
      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      // Read device manifest for orphan tracking
      const deviceManifest = await readDeviceManifest(sftp)
      const deviceUuids = deviceManifest ? parseManifestUuids(JSON.stringify(deviceManifest)) : []

      // Backup current deployment
      mkdirSync(devicePaths.backupDir, { recursive: true })
      if (!existsSync(devicePaths.originalBackup)) {
        // First deploy: snapshot the device's actual current state (pre-app)
        mkdirSync(devicePaths.originalBackup, { recursive: true })
        if (deviceUuids.length > 0) {
          // Device has existing templates — pull them into .original/
          const totalOrigFiles = deviceUuids.length * 3
          let origCount = 0
          stream.progress('Capturing original device state', 0, totalOrigFiles)
          for (const uuid of deviceUuids) {
            for (const ext of ['.template', '.metadata', '.content']) {
              try {
                await pullFile(sftp, `${RM_METHODS_PATH}/${uuid}${ext}`, resolve(devicePaths.originalBackup, `${uuid}${ext}`))
              } catch (err) {
                console.warn(`[deploy] Skipping original ${uuid}${ext}: ${err instanceof Error ? err.message : String(err)}`)
              }
              origCount++
              stream.progress('Capturing original device state', origCount, totalOrigFiles)
            }
          }
          // Save the device manifest as the original manifest
          writeFileSync(
            resolve(devicePaths.originalBackup, '.manifest'),
            deviceManifest ? JSON.stringify(deviceManifest, null, 2) : '{"exportedAt":"0","templates":{}}',
            'utf8',
          )
          steps.push(`Captured pristine device state (${deviceUuids.length} existing templates)`)
        } else {
          // Device is clean — empty manifest
          writeFileSync(resolve(devicePaths.originalBackup, '.manifest'), '{"exportedAt":"0","templates":{}}', 'utf8')
          steps.push('Captured pristine device state (clean)')
        }
      }

      if (existsSync(devicePaths.deployedManifest)) {
        const ts = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15)
        const backupDir = resolve(devicePaths.backupDir, `rm-methods_${ts}`)
        mkdirSync(backupDir, { recursive: true })
        copyFileSync(devicePaths.deployedManifest, resolve(backupDir, '.manifest'))

        // Pull deployed files for backup
        const localUuids = readManifestUuids(devicePaths.deployedManifest)
        const allUuids = mergeDeployedUuids(localUuids, deviceUuids)
        const totalBackupFiles = allUuids.length * 3
        let backupCount = 0
        stream.progress('Backing up current deployment', 0, totalBackupFiles)
        for (const uuid of allUuids) {
          for (const ext of ['.template', '.metadata', '.content']) {
            try {
              await pullFile(sftp, `${RM_METHODS_PATH}/${uuid}${ext}`, resolve(backupDir, `${uuid}${ext}`))
            } catch (err) {
              console.warn(`[deploy] Skipping backup ${uuid}${ext}: ${err instanceof Error ? err.message : String(err)}`)
            }
            backupCount++
            stream.progress('Backing up current deployment', backupCount, totalBackupFiles)
          }
        }
        steps.push(`Backed up ${allUuids.length} templates`)
      }

      if (isSelective) {
        // Selective deploy: only push selected template UUIDs
        const selectedSet = new Set(selectiveIds)

        // Push only files matching selected UUIDs
        const pushed = await pushDirectory(sftp, distDir, RM_METHODS_PATH, f => {
          if (f === '.manifest') return false
          // File names are UUID.ext — extract UUID part
          const dotIdx = f.lastIndexOf('.')
          const uuid = dotIdx >= 0 ? f.slice(0, dotIdx) : f
          return selectedSet.has(uuid)
        }, (cur, tot) => {
          stream.progress('Pushing files', cur, tot)
        })
        steps.push(`Pushed ${pushed.length} files (selective)`)

        // Deployed manifest = union of previously deployed + newly selected (additive merge)
        const buildManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as RmMethodsManifest

        // Start with existing deployed manifest if available
        let mergedManifest: RmMethodsManifest
        try {
          mergedManifest = JSON.parse(readFileSync(devicePaths.deployedManifest, 'utf8')) as RmMethodsManifest
        } catch {
          mergedManifest = { exportedAt: buildManifest.exportedAt, templates: {} }
        }

        // Add/update selected templates from the new build
        for (const uuid of selectiveIds) {
          if (buildManifest.templates[uuid]) {
            mergedManifest.templates[uuid] = buildManifest.templates[uuid]
          }
        }
        mergedManifest.exportedAt = buildManifest.exportedAt

        // Write merged manifest (no orphan cleanup for selective deploys)
        // Write device manifest first — if it fails, local state stays consistent
        stream.progress('Updating device manifest...')
        await writeDeviceManifest(sftp, mergedManifest)
        writeFileSync(devicePaths.deployedManifest, JSON.stringify(mergedManifest, null, 2), 'utf8')
      } else {
        // Full deploy: orphan cleanup + push all
        const localUuids = readManifestUuids(devicePaths.deployedManifest)
        const allPreviousUuids = mergeDeployedUuids(localUuids, deviceUuids)
        const newUuids = new Set(readManifestUuids(manifestPath))
        const orphans = allPreviousUuids.filter(uuid => !newUuids.has(uuid))
        if (orphans.length > 0) {
          const filesToRemove = orphans.flatMap(uuid => [`${uuid}.template`, `${uuid}.metadata`, `${uuid}.content`])
          await removeFiles(sftp, RM_METHODS_PATH, filesToRemove, (cur, tot) => {
            stream.progress('Removing orphaned templates', cur, tot)
          })
          steps.push(`Removed ${orphans.length} orphaned templates`)

          // Clean up local methods-registry.json and methods template files for orphaned UUIDs
          const orphanSet = new Set(orphans)
          if (existsSync(config.methodsRegistry)) {
            try {
              const registry = JSON.parse(readFileSync(config.methodsRegistry, 'utf8')) as Array<{ rmMethodsId?: string }>
              const filtered = registry.filter(entry => !entry.rmMethodsId || !orphanSet.has(entry.rmMethodsId))
              const removed = registry.length - filtered.length
              if (removed > 0) {
                writeFileSync(config.methodsRegistry, JSON.stringify(filtered, null, 2), 'utf8')
                steps.push(`Cleaned up ${removed} stale methods entries`)
              }
            } catch (err) {
              console.warn(`[deploy] Failed to clean methods-registry.json: ${err instanceof Error ? err.message : String(err)}`)
            }
          }
          for (const uuid of orphans) {
            const templateFile = resolve(config.methodsDir, `${uuid}.template`)
            if (existsSync(templateFile)) {
              unlinkSync(templateFile)
            }
          }
        }

        // Push new templates
        const pushed = await pushDirectory(sftp, distDir, RM_METHODS_PATH, f => f !== '.manifest', (cur, tot) => {
          stream.progress('Pushing files', cur, tot)
        })
        steps.push(`Pushed ${pushed.length} files`)

        // Update deployed manifest — device first, then local cache
        stream.progress('Updating device manifest...')
        await writeDeviceManifest(sftp, buildResult.manifest)
        copyFileSync(manifestPath, devicePaths.deployedManifest)
      }

      // Restart xochitl
      stream.progress('Restarting device UI...')
      await exec(client, 'systemctl restart xochitl')
      steps.push('Restarted xochitl')

      stream.done({ steps })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      stream.error(`Deploy failed: ${formatted.message}`, formatted.hint, formatted.rawError)
    } finally {
      client?.end()
    }
  })

  // POST /api/devices/:id/deploy-classic
  app.post<{ Params: { id: string } }>('/api/devices/:id/deploy-classic', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const stream = createNdjsonStream(reply)

    let client2: Awaited<ReturnType<typeof connect>> | null = null
    try {
      const steps: string[] = []

      stream.progress('Building templates...')
      const buildResult = buildClassicDist(config)
      writeClassicDist(config, buildResult)
      steps.push(`Built ${buildResult.templateCount} templates`)

      const distDir = config.classicDistDir

      client2 = await connect(deviceConfig)
      const sftp = await getSftp(client2)

      stream.progress('Creating backup on device...')
      await exec(client2, `mount -o remount,rw / && mkdir -p /home/root/template-backups && timestamp=$(date +%Y%m%d_%H%M%S) && tar czf /home/root/template-backups/templates_\${timestamp}.tar.gz -C /usr/share/remarkable templates`)
      steps.push('Created backup on device')

      const pushed = await pushDirectory(sftp, distDir, TEMPLATES_PATH, undefined, (cur, tot) => {
        stream.progress('Pushing files', cur, tot)
      })
      steps.push(`Pushed ${pushed.length} files`)

      stream.progress('Restarting device UI...')
      await exec(client2, 'mount -o remount,ro / && systemctl restart xochitl')
      steps.push('Restarted xochitl')

      stream.done({ steps })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      stream.error(`Deploy failed: ${formatted.message}`, formatted.hint, formatted.rawError)
    } finally {
      client2?.end()
    }
  })
}
