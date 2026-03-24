/**
 * Device pull operations.
 *
 * Pulls template files from a connected reMarkable device via SSH/SFTP.
 *
 * Routes:
 * - `POST /api/devices/:id/pull-official` -- pull official templates from `/usr/share/remarkable/templates`,
 *   save to `remarkable_official_templates/`, and enrich registry entries with generated icon data.
 * - `POST /api/devices/:id/pull-methods`  -- scan the device's xochitl data directory for
 *   `TemplateType` metadata, pull `.template`/`.metadata` pairs, build the methods registry,
 *   and import any custom-methods entries into the custom registry.
 *
 * Both routes stream NDJSON progress events to the client.
 *
 * @module
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, mkdirSync, rmdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { tmpdir } from 'node:os'
import type { ServerConfig } from '../../config.ts'
import { resolveDevicePaths } from '../../config.ts'
import { connect, exec } from '../../lib/ssh.ts'
import { getSftp, pullDirectory, pullFile } from '../../lib/sftp.ts'
import { buildMethodsRegistry } from '../../lib/buildMethodsRegistry.ts'
import { importCustomMethodsEntries } from '../../lib/importCustomMethods.ts'
import { readDeviceManifest, parseManifestUuids } from '../../lib/deviceManifest.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import { parseTemplate } from '../../../src/lib/parser.ts'
import { generateTemplateIcon } from '../../../src/lib/iconGenerator.ts'
import { createTrackedNdjsonStream, OperationAlreadyRunningError } from '../../lib/operationTracker.ts'
import { readDevice } from '../../lib/deviceStore.ts'

const RM_METHODS_PATH = '/home/root/.local/share/remarkable/xochitl'
const TEMPLATES_PATH = '/usr/share/remarkable/templates'

/**
 * Registers device pull routes on the given Fastify instance.
 *
 * @param app - Fastify instance to register routes on
 * @param config - Resolved server configuration with device store and template directory paths
 */
export default function devicePullRoutes(app: FastifyInstance, config: ServerConfig) {
  // POST /api/devices/:id/pull-official
  app.post<{ Params: { id: string } }>('/api/devices/:id/pull-official', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    let stream
    try { stream = createTrackedNdjsonStream(reply, id, 'pull-official') }
    catch (e) { if (e instanceof OperationAlreadyRunningError) return reply.status(409).send({ error: e.message, operationName: e.operationName }); throw e }

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)
      mkdirSync(config.officialDir, { recursive: true })

      const pulled = await pullDirectory(sftp, TEMPLATES_PATH, config.officialDir, undefined, (cur, tot) => {
        stream.progress('Pulling templates', cur, tot)
      })

      // Post-process: enrich registry entries with iconData
      try {
        const registryPath = resolve(config.officialDir, 'templates.json')
        if (existsSync(registryPath)) {
          const reg = JSON.parse(readFileSync(registryPath, 'utf8')) as { templates: Array<Record<string, unknown>> }
          for (const entry of reg.templates) {
            try {
              const tplFile = resolve(config.officialDir, `${entry.filename as string}.template`)
              if (existsSync(tplFile)) {
                const tpl = parseTemplate(JSON.parse(readFileSync(tplFile, 'utf8')))
                entry.iconData = generateTemplateIcon(tpl)
              }
            } catch { /* skip individual icon failures */ }
          }
          writeFileSync(registryPath, JSON.stringify(reg, null, 2), 'utf8')
        }
      } catch { /* non-fatal */ }

      stream.done({ count: pulled.length, files: pulled })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      stream.error(`Pull failed: ${formatted.message}`, formatted.hint, formatted.rawError)
    } finally {
      client?.end()
    }
  })

  // POST /api/devices/:id/pull-methods
  app.post<{ Params: { id: string } }>('/api/devices/:id/pull-methods', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const devicePaths = resolveDevicePaths(config, id)
    let stream
    try { stream = createTrackedNdjsonStream(reply, id, 'pull-methods') }
    catch (e) { if (e instanceof OperationAlreadyRunningError) return reply.status(409).send({ error: e.message, operationName: e.operationName }); throw e }

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      stream.progress('Scanning device for templates...')
      client = await connect(deviceConfig)

      const result = await exec(client, `grep -rl '"type": *"TemplateType"' ${RM_METHODS_PATH}/*.metadata 2>/dev/null || true`)
      const metadataFiles = result.stdout.trim().split('\n').filter(Boolean)

      if (metadataFiles.length === 0) {
        client.end()
        client = null
        stream.done({ count: 0, message: 'No rm_methods templates found on device.' })
        return
      }

      const tmpDir = resolve(tmpdir(), `rm-methods-pull-${Date.now()}`)
      mkdirSync(tmpDir, { recursive: true })
      const sftp = await getSftp(client)

      const totalFiles = metadataFiles.length * 2
      let pulledCount = 0
      for (const metaPath of metadataFiles) {
        const uuid = basename(metaPath, '.metadata')
        await pullFile(sftp, metaPath, resolve(tmpDir, `${uuid}.metadata`))
        pulledCount++
        stream.progress('Pulling template files', pulledCount, totalFiles)
        try {
          await pullFile(sftp, `${RM_METHODS_PATH}/${uuid}.template`, resolve(tmpDir, `${uuid}.template`))
        } catch (err) {
          request.log.warn(`[pull] Template file missing for ${uuid}: ${err instanceof Error ? err.message : String(err)}`)
        }
        pulledCount++
        stream.progress('Pulling template files', pulledCount, totalFiles)
      }

      stream.progress('Reading device manifest...')
      const deviceManifest = await readDeviceManifest(sftp)
      const deviceManifestUuids = deviceManifest
        ? parseManifestUuids(JSON.stringify(deviceManifest))
        : []
      client.end()
      client = null

      stream.progress('Building methods registry...')
      const manifestPath = existsSync(resolve(config.rmMethodsDistDir, '.manifest'))
        ? resolve(config.rmMethodsDistDir, '.manifest')
        : undefined
      const deployedManifestPath = existsSync(devicePaths.deployedManifest)
        ? devicePaths.deployedManifest
        : undefined

      // Read debug registry UUIDs so they're excluded from custom classification
      let debugUuids: string[] = []
      try {
        const debugReg = JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as {
          templates: Array<{ rmMethodsId?: string }>
        }
        debugUuids = debugReg.templates.map(e => e.rmMethodsId).filter((id): id is string => !!id)
      } catch { /* no debug registry */ }

      // Read sample registry UUIDs so they're excluded from methods registry
      let sampleUuids: string[] = []
      try {
        const samplesReg = JSON.parse(readFileSync(config.samplesRegistry, 'utf8')) as {
          templates: Array<{ rmMethodsId?: string }>
        }
        sampleUuids = samplesReg.templates.map(e => e.rmMethodsId).filter((id): id is string => !!id)
      } catch { /* no samples registry */ }

      const result2 = await buildMethodsRegistry({
        tempDir: tmpDir,
        outputDir: config.methodsDir,
        manifestPath,
        deployedManifestPath,
        deviceManifestUuids,
        debugUuids: [...debugUuids, ...sampleUuids],
      })

      const imported = importCustomMethodsEntries(config)

      try {
        for (const f of readdirSync(tmpDir)) unlinkSync(resolve(tmpDir, f))
        rmdirSync(tmpDir)
      } catch { /* best effort cleanup */ }

      stream.done({ count: result2.count, imported })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      stream.error(`Pull failed: ${formatted.message}`, formatted.hint, formatted.rawError)
    } finally {
      client?.end()
    }
  })
}
