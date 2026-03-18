/**
 * Device pull operations — replaces `make pull` and `make pull-rm-methods`.
 *
 * POST /api/device/pull-official  — pull official templates from device
 * POST /api/device/pull-methods   — pull rm_methods templates from device
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, mkdirSync, rmdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { tmpdir } from 'node:os'
import type { ServerConfig } from '../../config.ts'
import { connect, exec, type DeviceConfig } from '../../lib/ssh.ts'
import { getSftp, pullDirectory, pullFile } from '../../lib/sftp.ts'
import { buildMethodsRegistry } from '../../lib/buildMethodsRegistry.ts'

const RM_METHODS_PATH = '/home/root/.local/share/remarkable/xochitl'
const TEMPLATES_PATH = '/usr/share/remarkable/templates'

function readDeviceConfig(config: ServerConfig): DeviceConfig | null {
  try {
    return JSON.parse(readFileSync(config.deviceConfigPath, 'utf8')) as DeviceConfig
  } catch {
    return null
  }
}

export default function devicePullRoutes(app: FastifyInstance, config: ServerConfig) {
  // POST /api/device/pull-official
  app.post('/api/device/pull-official', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    try {
      const client = await connect(deviceConfig)
      const sftp = await getSftp(client)
      mkdirSync(config.officialDir, { recursive: true })

      const pulled = await pullDirectory(sftp, TEMPLATES_PATH, config.officialDir)
      client.end()

      return reply.send({ ok: true, count: pulled.length, files: pulled })
    } catch (e) {
      return reply.status(500).send({ error: `Pull failed: ${String(e)}` })
    }
  })

  // POST /api/device/pull-methods
  app.post('/api/device/pull-methods', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    try {
      const client = await connect(deviceConfig)

      // Find TemplateType metadata files
      const result = await exec(client, `grep -rl '"type": *"TemplateType"' ${RM_METHODS_PATH}/*.metadata 2>/dev/null || true`)
      const metadataFiles = result.stdout.trim().split('\n').filter(Boolean)

      if (metadataFiles.length === 0) {
        client.end()
        return reply.send({ ok: true, count: 0, message: 'No rm_methods templates found on device.' })
      }

      // Pull metadata + template pairs to temp dir
      const tmpDir = resolve(tmpdir(), `rm-methods-pull-${Date.now()}`)
      mkdirSync(tmpDir, { recursive: true })
      const sftp = await getSftp(client)

      for (const metaPath of metadataFiles) {
        const uuid = basename(metaPath, '.metadata')
        await pullFile(sftp, metaPath, resolve(tmpDir, `${uuid}.metadata`))
        try {
          await pullFile(sftp, `${RM_METHODS_PATH}/${uuid}.template`, resolve(tmpDir, `${uuid}.template`))
        } catch {
          // Template file may not exist
        }
      }
      client.end()

      // Build methods registry from pulled files
      const manifestPath = existsSync(resolve(config.rmMethodsDistDir, '.manifest'))
        ? resolve(config.rmMethodsDistDir, '.manifest')
        : undefined
      const deployedManifestPath = existsSync(config.rmMethodsDeployedManifest)
        ? config.rmMethodsDeployedManifest
        : undefined

      const result2 = await buildMethodsRegistry({
        tempDir: tmpDir,
        outputDir: config.methodsDir,
        manifestPath,
        deployedManifestPath,
      })

      // Cleanup temp dir
      try {
        for (const f of readdirSync(tmpDir)) unlinkSync(resolve(tmpDir, f))
        rmdirSync(tmpDir)
      } catch { /* best effort cleanup */ }

      return reply.send({ ok: true, count: result2.count })
    } catch (e) {
      return reply.status(500).send({ error: `Pull failed: ${String(e)}` })
    }
  })
}
