/**
 * Remove all custom templates from the device.
 *
 * POST /api/devices/:id/remove-all-preview          — list templates that would be removed
 * POST /api/devices/:id/remove-all-execute           — backup + remove + restart
 * GET  /api/devices/:id/remove-all-backup/:filename  — download backup ZIP
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import type { ServerConfig } from '../../config.ts'
import { resolveDevicePaths } from '../../config.ts'
import { connect, exec } from '../../lib/ssh.ts'
import { getSftp, removeFiles, readRemoteFile } from '../../lib/sftp.ts'
import { readManifestUuids } from '../../lib/manifestUuids.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import { assertWithin } from '../../lib/pathSecurity.ts'
import { createNdjsonStream } from '../../lib/ndjsonStream.ts'
import { readDevice } from '../../lib/deviceStore.ts'
import {
  RM_METHODS_PATH,
  readDeviceManifest,
  removeDeviceManifest,
  parseManifestUuids,
  mergeDeployedUuids,
} from '../../lib/deviceManifest.ts'

export default function deviceRemoveAllRoutes(app: FastifyInstance, config: ServerConfig) {
  // GET /api/devices/:id/remove-all-backup/:filename
  app.get<{ Params: { id: string; filename: string } }>('/api/devices/:id/remove-all-backup/:filename', async (request, reply) => {
    const { id, filename } = request.params
    const devicePaths = resolveDevicePaths(config, id)
    const filepath = resolve(devicePaths.backupDir, filename)

    try {
      assertWithin(devicePaths.backupDir, filepath)
    } catch {
      return reply.status(400).send({ error: 'Invalid filename' })
    }

    if (!existsSync(filepath)) {
      return reply.status(404).send({ error: 'Backup not found' })
    }

    const data = readFileSync(filepath)
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .send(data)
  })

  // POST /api/devices/:id/remove-all-preview
  app.post<{ Params: { id: string } }>('/api/devices/:id/remove-all-preview', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const devicePaths = resolveDevicePaths(config, id)

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      const deviceManifest = await readDeviceManifest(sftp)
      const deviceUuids = deviceManifest ? parseManifestUuids(JSON.stringify(deviceManifest)) : []
      const localUuids = readManifestUuids(devicePaths.deployedManifest)
      const allUuids = mergeDeployedUuids(localUuids, deviceUuids)

      if (allUuids.length === 0) {
        return reply.send({ count: 0, error: 'No deploy history found. Cannot determine which templates are custom.' })
      }

      const templates: { uuid: string; name: string }[] = []
      const deviceTemplates = deviceManifest?.templates ?? {}
      let localManifestTemplates: Record<string, { name?: string }> = {}
      try {
        const localData = JSON.parse(readFileSync(devicePaths.deployedManifest, 'utf8'))
        localManifestTemplates = localData.templates ?? {}
      } catch { /* no local manifest */ }

      for (const uuid of allUuids) {
        const name =
          deviceTemplates[uuid]?.name ??
          (localManifestTemplates[uuid] as { name?: string })?.name ??
          uuid
        templates.push({ uuid, name })
      }

      return reply.send({ count: allUuids.length, templates })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Preview failed: ${formatted.message}`, hint: formatted.hint, rawError: formatted.rawError })
    } finally {
      client?.end()
    }
  })

  // POST /api/devices/:id/remove-all-execute
  app.post<{ Params: { id: string } }>('/api/devices/:id/remove-all-execute', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const devicePaths = resolveDevicePaths(config, id)
    const stream = createNdjsonStream(reply)

    let client2: Awaited<ReturnType<typeof connect>> | null = null
    try {
      const steps: string[] = []

      stream.progress('Connecting to device...')
      client2 = await connect(deviceConfig)
      const sftp = await getSftp(client2)

      const deviceManifest = await readDeviceManifest(sftp)
      const deviceUuids = deviceManifest ? parseManifestUuids(JSON.stringify(deviceManifest)) : []
      const localUuids = readManifestUuids(devicePaths.deployedManifest)
      const allUuids = mergeDeployedUuids(localUuids, deviceUuids)

      if (allUuids.length === 0) {
        stream.error('No deploy history found. Cannot determine which templates are custom.')
        return
      }

      steps.push(`Found ${allUuids.length} custom templates`)

      const fileMap: Record<string, Uint8Array> = {}
      const totalBackupFiles = allUuids.length * 3
      let backupCount = 0
      for (const uuid of allUuids) {
        for (const ext of ['.template', '.metadata', '.content']) {
          try {
            const content = await readRemoteFile(sftp, `${RM_METHODS_PATH}/${uuid}${ext}`)
            fileMap[`${uuid}${ext}`] = strToU8(content)
          } catch { /* file may not exist */ }
          backupCount++
          stream.progress('Backing up templates', backupCount, totalBackupFiles)
        }
      }

      if (deviceManifest) {
        fileMap['.remarkable-templates-deployed'] = strToU8(JSON.stringify(deviceManifest, null, 2))
      }

      stream.progress('Saving backup ZIP...')
      const zipped = zipSync(fileMap)
      const ts = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15)
      const backupFilename = `remove-all-backup-${ts}.zip`
      mkdirSync(devicePaths.backupDir, { recursive: true })
      const backupPath = resolve(devicePaths.backupDir, backupFilename)
      writeFileSync(backupPath, zipped)
      steps.push(`Saved backup: ${backupFilename} (${Object.keys(fileMap).length} files)`)

      if (!existsSync(backupPath)) {
        stream.error('Backup verification failed — ZIP was not saved')
        return
      }

      const filesToRemove = allUuids.flatMap(uuid => [`${uuid}.template`, `${uuid}.metadata`, `${uuid}.content`])
      const removed = await removeFiles(sftp, RM_METHODS_PATH, filesToRemove, (cur, tot) => {
        stream.progress('Removing files from device', cur, tot)
      })
      steps.push(`Removed ${removed.length} files from device`)

      try {
        await removeDeviceManifest(sftp)
        steps.push('Removed device manifest')
      } catch { /* may not exist */ }

      if (existsSync(devicePaths.deployedManifest)) {
        unlinkSync(devicePaths.deployedManifest)
        steps.push('Cleared local deploy tracking')
      }

      stream.progress('Restarting device UI...')
      await exec(client2, 'systemctl restart xochitl')
      steps.push('Restarted xochitl')

      stream.done({ steps, backupFilename })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      stream.error(`Remove all failed: ${formatted.message}`, formatted.hint, formatted.rawError)
    } finally {
      client2?.end()
    }
  })
}
