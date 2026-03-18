/**
 * Remove all custom templates from the device.
 *
 * POST /api/device/remove-all-preview   — list templates that would be removed
 * POST /api/device/remove-all-execute   — backup + remove + restart
 * GET  /api/device/remove-all-backup/:filename — download backup ZIP
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import type { ServerConfig } from '../../config.ts'
import { connect, exec, type DeviceConfig } from '../../lib/ssh.ts'
import { getSftp, removeFiles, readRemoteFile } from '../../lib/sftp.ts'
import { readManifestUuids } from '../../lib/manifestUuids.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import { assertWithin } from '../../lib/pathSecurity.ts'
import { createNdjsonStream } from '../../lib/ndjsonStream.ts'
import {
  RM_METHODS_PATH,
  readDeviceManifest,
  removeDeviceManifest,
  parseManifestUuids,
  mergeDeployedUuids,
} from '../../lib/deviceManifest.ts'

function readDeviceConfig(config: ServerConfig): DeviceConfig | null {
  try {
    return JSON.parse(readFileSync(config.deviceConfigPath, 'utf8')) as DeviceConfig
  } catch {
    return null
  }
}

export default function deviceRemoveAllRoutes(app: FastifyInstance, config: ServerConfig) {
  // GET /api/device/remove-all-backup/:filename
  app.get('/api/device/remove-all-backup/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string }
    const filepath = resolve(config.rmMethodsBackupDir, filename)

    try {
      assertWithin(config.rmMethodsBackupDir, filepath)
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

  // POST /api/device/remove-all-preview
  app.post('/api/device/remove-all-preview', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    try {
      const client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      // Read device manifest
      const deviceManifest = await readDeviceManifest(sftp)
      const deviceUuids = deviceManifest ? parseManifestUuids(JSON.stringify(deviceManifest)) : []
      const localUuids = readManifestUuids(config.rmMethodsDeployedManifest)
      const allUuids = mergeDeployedUuids(localUuids, deviceUuids)

      if (allUuids.length === 0) {
        client.end()
        return reply.send({ count: 0, error: 'No deploy history found. Cannot determine which templates are custom.' })
      }

      // Build template list with names from manifests
      const templates: { uuid: string; name: string }[] = []
      const deviceTemplates = deviceManifest?.templates ?? {}
      let localManifestTemplates: Record<string, { name?: string }> = {}
      try {
        const localData = JSON.parse(readFileSync(config.rmMethodsDeployedManifest, 'utf8'))
        localManifestTemplates = localData.templates ?? {}
      } catch { /* no local manifest */ }

      for (const uuid of allUuids) {
        const name =
          deviceTemplates[uuid]?.name ??
          (localManifestTemplates[uuid] as { name?: string })?.name ??
          uuid
        templates.push({ uuid, name })
      }

      client.end()
      return reply.send({ count: allUuids.length, templates })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Preview failed: ${formatted.message}`, hint: formatted.hint })
    }
  })

  // POST /api/device/remove-all-execute
  app.post('/api/device/remove-all-execute', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const stream = createNdjsonStream(reply)

    try {
      const steps: string[] = []

      stream.progress('Connecting to device...')
      const client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      // Read device manifest + merge with local
      const deviceManifest = await readDeviceManifest(sftp)
      const deviceUuids = deviceManifest ? parseManifestUuids(JSON.stringify(deviceManifest)) : []
      const localUuids = readManifestUuids(config.rmMethodsDeployedManifest)
      const allUuids = mergeDeployedUuids(localUuids, deviceUuids)

      if (allUuids.length === 0) {
        client.end()
        stream.error('No deploy history found. Cannot determine which templates are custom.')
        return
      }

      steps.push(`Found ${allUuids.length} custom templates`)

      // Pull all file triplets from device into ZIP
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

      // Include the device manifest in the backup
      if (deviceManifest) {
        fileMap['.remarkable-templates-deployed'] = strToU8(JSON.stringify(deviceManifest, null, 2))
      }

      // Create backup ZIP
      stream.progress('Saving backup ZIP...')
      const zipped = zipSync(fileMap)
      const ts = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15)
      const backupFilename = `remove-all-backup-${ts}.zip`
      mkdirSync(config.rmMethodsBackupDir, { recursive: true })
      const backupPath = resolve(config.rmMethodsBackupDir, backupFilename)
      writeFileSync(backupPath, zipped)
      steps.push(`Saved backup: ${backupFilename} (${Object.keys(fileMap).length} files)`)

      // Verify ZIP was written
      if (!existsSync(backupPath)) {
        client.end()
        stream.error('Backup verification failed — ZIP was not saved')
        return
      }

      // Remove file triplets from device
      const filesToRemove = allUuids.flatMap(uuid => [`${uuid}.template`, `${uuid}.metadata`, `${uuid}.content`])
      const removed = await removeFiles(sftp, RM_METHODS_PATH, filesToRemove, (cur, tot) => {
        stream.progress('Removing files from device', cur, tot)
      })
      steps.push(`Removed ${removed.length} files from device`)

      // Remove device manifest
      try {
        await removeDeviceManifest(sftp)
        steps.push('Removed device manifest')
      } catch { /* may not exist */ }

      // Clear local deployed manifest
      if (existsSync(config.rmMethodsDeployedManifest)) {
        unlinkSync(config.rmMethodsDeployedManifest)
        steps.push('Cleared local deploy tracking')
      }

      // Restart xochitl
      stream.progress('Restarting device UI...')
      await exec(client, 'systemctl restart xochitl')
      client.end()
      steps.push('Restarted xochitl')

      stream.done({ steps, backupFilename })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      stream.error(`Remove all failed: ${formatted.message}`, formatted.hint)
    }
  })
}
