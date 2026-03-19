/**
 * Device pull operations.
 *
 * POST /api/devices/:id/pull-official  — pull official templates from device
 * POST /api/devices/:id/pull-methods   — pull rm_methods templates from device
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
import { readDeviceManifest, parseManifestUuids } from '../../lib/deviceManifest.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import { createNdjsonStream } from '../../lib/ndjsonStream.ts'
import { readDevice } from '../../lib/deviceStore.ts'
import { mapForegroundColors } from '../../../src/lib/customTemplates.ts'

const RM_METHODS_PATH = '/home/root/.local/share/remarkable/xochitl'
const TEMPLATES_PATH = '/usr/share/remarkable/templates'

interface MethodsRegistryEntry {
  name: string
  filename: string
  iconCode: string
  landscape?: boolean
  categories: string[]
  rmMethodsId?: string
  origin?: string
}

/**
 * After building the methods registry, auto-import any custom-methods entries
 * into the custom collection so they appear as editable templates.
 * Skips entries already present in custom-registry.json (matched by rmMethodsId).
 */
function importCustomMethodsEntries(config: ServerConfig): number {
  let methodsEntries: MethodsRegistryEntry[]
  try {
    const raw = JSON.parse(readFileSync(config.methodsRegistry, 'utf8')) as { templates: MethodsRegistryEntry[] }
    methodsEntries = raw.templates.filter(e => e.origin === 'custom-methods')
  } catch {
    return 0
  }

  if (methodsEntries.length === 0) return 0

  let customRegistry: { templates: Array<{ filename: string; rmMethodsId?: string; [k: string]: unknown }> }
  try {
    customRegistry = JSON.parse(readFileSync(config.customRegistry, 'utf8')) as typeof customRegistry
  } catch {
    customRegistry = { templates: [] }
  }

  const existingIds = new Set(customRegistry.templates.map(e => e.rmMethodsId).filter(Boolean))
  let imported = 0

  mkdirSync(config.customDir, { recursive: true })

  for (const entry of methodsEntries) {
    if (!entry.rmMethodsId || existingIds.has(entry.rmMethodsId)) continue

    const srcPath = resolve(config.methodsDir, `${entry.rmMethodsId}.template`)
    if (!existsSync(srcPath)) continue

    const prefix = entry.landscape ? 'LS' : 'P'
    const customSlug = `${prefix} ${entry.name}`
    const destPath = resolve(config.customDir, `${customSlug}.template`)

    // Map hardcoded hex colors to foreground/background constants so inversion works
    const rawContent = readFileSync(srcPath, 'utf8')
    const mappedContent = mapForegroundColors(rawContent)
    writeFileSync(destPath, mappedContent, 'utf8')

    customRegistry.templates.push({
      name: entry.name,
      filename: `custom/${customSlug}`,
      iconCode: entry.iconCode,
      landscape: entry.landscape ?? false,
      categories: entry.categories,
      isCustom: true,
      rmMethodsId: entry.rmMethodsId,
    })
    imported++
  }

  if (imported > 0) {
    writeFileSync(config.customRegistry, JSON.stringify(customRegistry, null, 2) + '\n', 'utf8')
  }

  return imported
}

export default function devicePullRoutes(app: FastifyInstance, config: ServerConfig) {
  // POST /api/devices/:id/pull-official
  app.post<{ Params: { id: string } }>('/api/devices/:id/pull-official', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const stream = createNdjsonStream(reply)

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)
      mkdirSync(config.officialDir, { recursive: true })

      const pulled = await pullDirectory(sftp, TEMPLATES_PATH, config.officialDir, undefined, (cur, tot) => {
        stream.progress('Pulling templates', cur, tot)
      })

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
    const stream = createNdjsonStream(reply)

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
        } catch {
          // Template file may not exist
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

      const result2 = await buildMethodsRegistry({
        tempDir: tmpDir,
        outputDir: config.methodsDir,
        manifestPath,
        deployedManifestPath,
        deviceManifestUuids,
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
