/**
 * Notebook builder endpoints.
 *
 * POST /api/notebooks/export                  — generate & download notebook ZIP
 * POST /api/devices/:id/deploy-notebook       — deploy notebook to device
 * POST /api/devices/:id/check-notebook        — check if notebook exists on device
 */

import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import type { ServerConfig } from '../config.ts'
import { connect, exec } from '../lib/ssh.ts'
import { getSftp, pushFile, readRemoteFile } from '../lib/sftp.ts'
import { formatSshError } from '../lib/sshErrors.ts'
import { createNdjsonStream } from '../lib/ndjsonStream.ts'
import { readDevice } from '../lib/deviceStore.ts'
import { RM_METHODS_PATH } from '../lib/deviceManifest.ts'
import {
  expandPageGroups,
  generateNotebookContent,
  generateNotebookMetadata,
  generateNotebookLocal,
  generateEmptyRmFile,
  EMPTY_RM_FILE_SIZE,
} from '../../src/lib/notebookGenerator.ts'
import type { PageGroup } from '../../src/types/notebook.ts'

interface NotebookBody {
  name?: string
  pageGroups?: PageGroup[]
  orientation?: 'portrait' | 'landscape'
  deviceId?: string
  /** If set, reuse this UUID instead of generating a new one (update-in-place) */
  reuseUuid?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateBody(body: NotebookBody | undefined): body is NotebookBody & { name: string; pageGroups: PageGroup[] } {
  if (!body?.name || typeof body.name !== 'string' || body.name.trim().length === 0) return false
  if (!Array.isArray(body.pageGroups) || body.pageGroups.length === 0) return false
  if (body.reuseUuid && !UUID_RE.test(body.reuseUuid)) return false
  return true
}

export default function notebookRoutes(app: FastifyInstance, config: ServerConfig) {
  // POST /api/notebooks/export — download notebook as ZIP
  app.post('/api/notebooks/export', async (request, reply) => {
    const body = request.body as NotebookBody | undefined

    if (!validateBody(body)) {
      const msg = !body?.name ? 'Notebook name is required' : 'At least one page group is required'
      return reply.status(400).send({ error: msg })
    }

    const orientation = body.orientation ?? 'portrait'
    const deviceId = (body.deviceId ?? 'rm') as import('../../src/lib/renderer.ts').DeviceId
    const pages = expandPageGroups(body.pageGroups)
    if (pages.length === 0) {
      return reply.status(400).send({ error: 'Page groups resulted in zero pages' })
    }
    const notebookUuid = randomUUID()

    const content = generateNotebookContent(pages, orientation, deviceId)
    const metadata = generateNotebookMetadata(body.name.trim())
    const local = generateNotebookLocal()

    const fileMap: Record<string, Uint8Array> = {
      [`${notebookUuid}.content`]: strToU8(JSON.stringify(content, null, 4)),
      [`${notebookUuid}.metadata`]: strToU8(JSON.stringify(metadata, null, 4)),
      [`${notebookUuid}.local`]: strToU8(JSON.stringify(local, null, 4)),
    }
    // Only include .rm stubs for devices that need them (PPM requires them;
    // RM1/RM2 and Paper Pro create their own on first page access)
    const emptyRm = generateEmptyRmFile(deviceId)
    if (emptyRm) {
      for (const page of pages) {
        fileMap[`${notebookUuid}/${page.id}.rm`] = emptyRm
      }
    }

    const zipped = zipSync(fileMap)
    const filename = `${body.name.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.notebook.zip`

    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .header('content-length', String(zipped.length))
      .send(Buffer.from(zipped))
  })

  // POST /api/devices/:id/check-notebook — check if a previously deployed notebook still exists on device
  // Uses UUID-based file lookup (fast) instead of grepping through all metadata files.
  app.post<{ Params: { id: string } }>('/api/devices/:id/check-notebook', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const body = request.body as { uuid?: string } | undefined
    const uuid = body?.uuid?.trim()
    if (!uuid || !UUID_RE.test(uuid)) {
      return reply.status(400).send({ error: 'Valid notebook UUID is required' })
    }

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      // Check if the UUID triplet (.content, .metadata, .local) exists on device
      const metaPath = `${RM_METHODS_PATH}/${uuid}.metadata`
      let metaRaw: string
      try {
        metaRaw = await readRemoteFile(sftp, metaPath)
      } catch {
        // File doesn't exist — notebook not on device
        return reply.send({ exists: false })
      }

      const meta = JSON.parse(metaRaw) as {
        type?: string
        visibleName?: string
        deleted?: boolean
      }

      if (meta.deleted) {
        return reply.send({ exists: false })
      }

      // Check if notebook has been modified by looking for .rm files larger than
      // the empty stub we deploy. Modified pages have stroke data > EMPTY_RM_FILE_SIZE bytes.
      const rmCheck = await exec(client,
        `find ${RM_METHODS_PATH}/${uuid} -name '*.rm' -size +${EMPTY_RM_FILE_SIZE}c 2>/dev/null | wc -l`,
      )
      const rmFileCount = parseInt(rmCheck.stdout.trim(), 10) || 0

      // Read .content to get page count
      let pageCount = 0
      try {
        const contentRaw = await readRemoteFile(sftp, `${RM_METHODS_PATH}/${uuid}.content`)
        const content = JSON.parse(contentRaw) as { pageCount?: number }
        pageCount = content.pageCount ?? 0
      } catch { /* ignore */ }

      return reply.send({
        exists: true,
        uuid,
        pristine: rmFileCount === 0,
        pageCount,
        visibleName: meta.visibleName,
      })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Check failed: ${formatted.message}`, hint: formatted.hint })
    } finally {
      client?.end()
    }
  })

  // POST /api/devices/:id/deploy-notebook — deploy notebook to device via SFTP
  app.post<{ Params: { id: string } }>('/api/devices/:id/deploy-notebook', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const body = request.body as NotebookBody | undefined
    if (!validateBody(body)) {
      const msg = !body?.name ? 'Notebook name is required' : 'At least one page group is required'
      return reply.status(400).send({ error: msg })
    }

    const stream = createNdjsonStream(reply)
    let client: Awaited<ReturnType<typeof connect>> | null = null
    let stagingDir: string | null = null

    try {
      const steps: string[] = []
      const orientation = body.orientation ?? 'portrait'
      const deviceId = (body.deviceId ?? 'rm') as import('../../src/lib/renderer.ts').DeviceId

      // Generate notebook files
      stream.progress('Generating notebook...')
      const pages = expandPageGroups(body.pageGroups)
      if (pages.length === 0) {
        stream.error('Page groups resulted in zero pages')
        return
      }
      const notebookUuid = body.reuseUuid ?? randomUUID()
      const content = generateNotebookContent(pages, orientation, deviceId)
      const metadata = generateNotebookMetadata(body.name.trim())
      const local = generateNotebookLocal()

      // Write to staging dir
      stagingDir = resolve(config.notebookDistDir, notebookUuid)
      mkdirSync(stagingDir, { recursive: true })
      writeFileSync(resolve(stagingDir, `${notebookUuid}.content`), JSON.stringify(content, null, 4), 'utf8')
      writeFileSync(resolve(stagingDir, `${notebookUuid}.metadata`), JSON.stringify(metadata, null, 4), 'utf8')
      writeFileSync(resolve(stagingDir, `${notebookUuid}.local`), JSON.stringify(local, null, 4), 'utf8')

      // Only write .rm stubs for devices that need them (PPM requires them;
      // RM1/RM2 and Paper Pro create their own on first page access)
      const emptyRm = generateEmptyRmFile(deviceId)
      if (emptyRm) {
        const pagesDir = resolve(stagingDir, notebookUuid)
        mkdirSync(pagesDir, { recursive: true })
        for (const page of pages) {
          writeFileSync(resolve(pagesDir, `${page.id}.rm`), emptyRm)
        }
      }
      steps.push(`Generated notebook "${body.name}" with ${pages.length} pages`)

      // Connect and push
      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)

      const rmFileCount = emptyRm ? pages.length : 0
      const totalFiles = 3 + rmFileCount // .content, .metadata, .local + per-page .rm files (if needed)
      stream.progress('Pushing notebook files...', 0, totalFiles)
      let pushed = 0

      // Push metadata files
      const extensions = ['.content', '.metadata', '.local']
      for (const ext of extensions) {
        const localPath = resolve(stagingDir, `${notebookUuid}${ext}`)
        const remotePath = `${RM_METHODS_PATH}/${notebookUuid}${ext}`
        await pushFile(sftp, localPath, remotePath)
        stream.progress('Pushing notebook files...', ++pushed, totalFiles)
      }

      // Create page directory and push .rm stubs (only for devices that need them)
      const remotePageDir = `${RM_METHODS_PATH}/${notebookUuid}`
      await exec(client, `mkdir -p "${remotePageDir}"`)
      if (emptyRm) {
        const pagesDir = resolve(stagingDir, notebookUuid)
        for (const page of pages) {
          const localPath = resolve(pagesDir, `${page.id}.rm`)
          const remotePath = `${remotePageDir}/${page.id}.rm`
          await pushFile(sftp, localPath, remotePath)
          stream.progress('Pushing notebook files...', ++pushed, totalFiles)
        }
      }
      steps.push(`Pushed ${totalFiles} files to device`)

      // Restart xochitl
      stream.progress('Restarting device UI...')
      await exec(client, 'systemctl restart xochitl')
      steps.push('Restarted xochitl')

      stream.done({ steps, notebookUuid })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      stream.error(`Deploy failed: ${formatted.message}`, formatted.hint, formatted.rawError)
    } finally {
      client?.end()
      if (stagingDir) try { rmSync(stagingDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })
}
