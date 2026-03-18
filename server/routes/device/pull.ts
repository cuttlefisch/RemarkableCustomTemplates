/**
 * Device pull operations — replaces `make pull` and `make pull-rm-methods`.
 *
 * POST /api/device/pull-official  — pull official templates from device
 * POST /api/device/pull-methods   — pull rm_methods templates from device
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { tmpdir } from 'node:os'
import type { ServerConfig } from '../../config.ts'
import { connect, exec, type DeviceConfig } from '../../lib/ssh.ts'
import { getSftp, pullDirectory, pullFile } from '../../lib/sftp.ts'
import { buildMethodsRegistry } from '../../lib/buildMethodsRegistry.ts'
import { readDeviceManifest, parseManifestUuids } from '../../lib/deviceManifest.ts'
import { formatSshError } from '../../lib/sshErrors.ts'

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
  // Read methods registry
  let methodsEntries: MethodsRegistryEntry[]
  try {
    const raw = JSON.parse(readFileSync(config.methodsRegistry, 'utf8')) as { templates: MethodsRegistryEntry[] }
    methodsEntries = raw.templates.filter(e => e.origin === 'custom-methods')
  } catch {
    return 0
  }

  if (methodsEntries.length === 0) return 0

  // Read existing custom registry
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

    // Copy template file from methods/ to custom/
    const srcPath = resolve(config.methodsDir, `${entry.rmMethodsId}.template`)
    if (!existsSync(srcPath)) continue

    const prefix = entry.landscape ? 'LS' : 'P'
    const customSlug = `${prefix} ${entry.name}`
    const destPath = resolve(config.customDir, `${customSlug}.template`)
    copyFileSync(srcPath, destPath)

    // Add to custom registry
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
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Pull failed: ${formatted.message}`, hint: formatted.hint })
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

      // Read device manifest for custom UUID detection before closing connection
      const deviceManifest = await readDeviceManifest(sftp)
      const deviceManifestUuids = deviceManifest
        ? parseManifestUuids(JSON.stringify(deviceManifest))
        : []
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
        deviceManifestUuids,
      })

      // Auto-import custom-methods entries into the custom collection
      const imported = importCustomMethodsEntries(config)

      // Cleanup temp dir
      try {
        for (const f of readdirSync(tmpDir)) unlinkSync(resolve(tmpDir, f))
        rmdirSync(tmpDir)
      } catch { /* best effort cleanup */ }

      return reply.send({ ok: true, count: result2.count, imported })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Pull failed: ${formatted.message}`, hint: formatted.hint })
    }
  })
}
