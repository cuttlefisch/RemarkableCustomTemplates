/**
 * GET /api/backup — export backup ZIP
 * POST /api/restore — import backup ZIP
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { zipSync, unzipSync, strToU8 } from 'fflate'
import type { ServerConfig } from '../config.ts'
import { assertWithin } from '../lib/pathSecurity.ts'
import { buildBackupManifest, validateBackupContents, computeMergeActions } from '../../src/lib/backup.ts'
import { parseRegistry } from '../../src/lib/registry.ts'

export default function backupRoutes(app: FastifyInstance, config: ServerConfig) {
  // GET /api/backup
  app.get('/api/backup', async (_request, reply) => {
    let customReg: { templates: unknown[] } = { templates: [] }
    let debugReg: { templates: unknown[] } = { templates: [] }
    try { customReg = JSON.parse(readFileSync(config.customRegistry, 'utf8')) as typeof customReg } catch { /* empty */ }
    try { debugReg = JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as typeof debugReg } catch { /* empty */ }

    const manifest = buildBackupManifest(customReg.templates.length, debugReg.templates.length)
    const fileMap: Record<string, Uint8Array> = {}
    fileMap['backup-manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))

    if (customReg.templates.length > 0) {
      fileMap['custom/custom-registry.json'] = strToU8(JSON.stringify(customReg, null, 2))
    }
    if (debugReg.templates.length > 0) {
      fileMap['debug/debug-registry.json'] = strToU8(JSON.stringify(debugReg, null, 2))
    }

    if (existsSync(config.customDir)) {
      for (const file of readdirSync(config.customDir)) {
        if (file.endsWith('.template')) {
          try {
            const raw = readFileSync(resolve(config.customDir, file), 'utf8')
            const parsed = JSON.parse(raw)
            fileMap[`custom/${file}`] = strToU8(JSON.stringify(parsed, null, 2))
          } catch (err) {
            console.warn(`[backup] Skipping broken custom template "${file}": ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    if (existsSync(config.debugDir)) {
      for (const file of readdirSync(config.debugDir)) {
        if (file.endsWith('.template')) {
          try {
            const raw = readFileSync(resolve(config.debugDir, file), 'utf8')
            const parsed = JSON.parse(raw)
            fileMap[`debug/${file}`] = strToU8(JSON.stringify(parsed, null, 2))
          } catch (err) {
            console.warn(`[backup] Skipping broken debug template "${file}": ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // Include deployed manifest for device state tracking
    if (existsSync(config.rmMethodsDeployedManifest)) {
      try {
        fileMap['manifests/.deployed-manifest'] = strToU8(readFileSync(config.rmMethodsDeployedManifest, 'utf8'))
      } catch (err) {
        console.warn(`[backup] Skipping deployed manifest: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Include rm-methods-dist files (UUID triplets + manifest) for full deploy restore
    if (existsSync(config.rmMethodsDistDir)) {
      for (const file of readdirSync(config.rmMethodsDistDir)) {
        try {
          fileMap[`rm-methods-dist/${file}`] = new Uint8Array(readFileSync(resolve(config.rmMethodsDistDir, file)))
        } catch (err) {
          console.warn(`[backup] Skipping rm-methods-dist file "${file}": ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    const zipped = zipSync(fileMap)
    const now = new Date()
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`

    // Save a server-side copy so the backup appears in the backups list
    mkdirSync(config.appBackupsDir, { recursive: true })
    const backupFilename = `remarkable-backup-${dateStr}.zip`
    writeFileSync(resolve(config.appBackupsDir, backupFilename), Buffer.from(zipped))

    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${backupFilename}"`)
      .header('content-length', String(zipped.length))
      .send(Buffer.from(zipped))
  })

  // POST /api/restore
  app.post('/api/restore', async (request, reply) => {
    const mode = (request.query as Record<string, string>).mode ?? 'merge'
    if (mode !== 'merge' && mode !== 'replace') {
      return reply.status(400).send({ error: `Invalid mode: "${mode}" (expected "merge" or "replace")` })
    }

    const rawBody = await request.body as Buffer
    if (rawBody.length > 50 * 1024 * 1024) {
      return reply.status(400).send({ error: 'Backup file too large (max 50MB)' })
    }

    const unzipped = unzipSync(new Uint8Array(rawBody))
    const files: Record<string, Uint8Array> = {}
    for (const [k, v] of Object.entries(unzipped)) {
      files[k] = v
    }

    const validation = validateBackupContents(files)
    if (!validation.valid) {
      return reply.status(400).send({ error: 'Invalid backup', details: validation.errors })
    }

    const added: string[] = []
    const skipped: string[] = []
    const removed: string[] = []

    if (mode === 'replace') {
      let oldCustom: string | null = null
      let oldDebug: string | null = null
      try { oldCustom = readFileSync(config.customRegistry, 'utf8') } catch { /* empty */ }
      try { oldDebug = readFileSync(config.debugRegistry, 'utf8') } catch { /* empty */ }

      // Track what existed before so we can report removals
      let prevCustomNames: string[] = []
      let prevDebugNames: string[] = []
      try {
        const reg = JSON.parse(oldCustom ?? '{"templates":[]}') as { templates: Array<{ name?: string; filename: string }> }
        prevCustomNames = reg.templates.map(t => t.name ?? t.filename)
      } catch { /* empty */ }
      try {
        const reg = JSON.parse(oldDebug ?? '{"templates":[]}') as { templates: Array<{ name?: string; filename: string }> }
        prevDebugNames = reg.templates.map(t => t.name ?? t.filename)
      } catch { /* empty */ }

      const incomingCustomNames = new Set(validation.customRegistry?.templates.map(t => t.name) ?? [])
      const incomingDebugNames = new Set(validation.debugRegistry?.templates.map(t => t.name) ?? [])

      try {
        // Replace custom registry and templates
        if (validation.customRegistry) {
          mkdirSync(config.customDir, { recursive: true })
          // Remove old .template files not in the backup
          for (const file of readdirSync(config.customDir)) {
            if (file.endsWith('.template')) {
              const inBackup = validation.customTemplateFiles.some(p => p === `custom/${file}`)
              if (!inBackup) {
                const rmPath = resolve(config.customDir, file)
                assertWithin(config.customDir, rmPath)
                const { unlinkSync } = await import('node:fs')
                unlinkSync(rmPath)
              }
            }
          }
          writeFileSync(config.customRegistry, JSON.stringify({ templates: validation.customRegistry.templates }, null, 2), 'utf8')
          for (const path of validation.customTemplateFiles) {
            const filename = path.replace('custom/', '')
            const outPath = resolve(config.customDir, filename)
            assertWithin(config.customDir, outPath)
            writeFileSync(outPath, Buffer.from(files[path]))
            added.push(path)
          }
        } else if (existsSync(config.customRegistry)) {
          // Backup has no custom templates — clear them all
          writeFileSync(config.customRegistry, JSON.stringify({ templates: [] }, null, 2), 'utf8')
        }

        // Replace debug registry and templates
        if (validation.debugRegistry) {
          mkdirSync(config.debugDir, { recursive: true })
          for (const file of readdirSync(config.debugDir)) {
            if (file.endsWith('.template')) {
              const inBackup = validation.debugTemplateFiles.some(p => p === `debug/${file}`)
              if (!inBackup) {
                const rmPath = resolve(config.debugDir, file)
                assertWithin(config.debugDir, rmPath)
                const { unlinkSync } = await import('node:fs')
                unlinkSync(rmPath)
              }
            }
          }
          writeFileSync(config.debugRegistry, JSON.stringify({ templates: validation.debugRegistry.templates }, null, 2), 'utf8')
          for (const path of validation.debugTemplateFiles) {
            const filename = path.replace('debug/', '')
            const outPath = resolve(config.debugDir, filename)
            assertWithin(config.debugDir, outPath)
            writeFileSync(outPath, Buffer.from(files[path]))
            added.push(path)
          }
        } else if (existsSync(config.debugRegistry)) {
          writeFileSync(config.debugRegistry, JSON.stringify({ templates: [] }, null, 2), 'utf8')
        }

        // Compute removed entries
        for (const name of prevCustomNames) {
          if (!incomingCustomNames.has(name)) removed.push(name)
        }
        for (const name of prevDebugNames) {
          if (!incomingDebugNames.has(name)) removed.push(name)
        }
      } catch (e) {
        try {
          if (oldCustom !== null) writeFileSync(config.customRegistry, oldCustom, 'utf8')
          if (oldDebug !== null) writeFileSync(config.debugRegistry, oldDebug, 'utf8')
        } catch { /* best effort */ }
        return reply.status(500).send({ error: `Restore failed: ${String(e)}` })
      }
    } else {
      // Merge mode
      let existingCustomReg: { templates: Array<{ filename: string; rmMethodsId?: string }> } = { templates: [] }
      let existingDebugReg: { templates: Array<{ filename: string; rmMethodsId?: string }> } = { templates: [] }
      try { existingCustomReg = JSON.parse(readFileSync(config.customRegistry, 'utf8')) as typeof existingCustomReg } catch { /* empty */ }
      try { existingDebugReg = JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as typeof existingDebugReg } catch { /* empty */ }

      if (validation.customRegistry) {
        const existingParsed = existingCustomReg.templates.map(e => parseRegistry({ templates: [e] }).templates[0])
        const actions = computeMergeActions(validation.customRegistry.templates, existingParsed)

        for (const action of actions) {
          if (action.action === 'add') {
            existingCustomReg.templates.push(action.entry)
            const shortName = action.entry.filename.replace(/^custom\//, '')
            const tplPath = `custom/${shortName}.template`
            if (files[tplPath]) {
              mkdirSync(config.customDir, { recursive: true })
              const outPath = resolve(config.customDir, `${shortName}.template`)
              assertWithin(config.customDir, outPath)
              writeFileSync(outPath, Buffer.from(files[tplPath]))
            }
            added.push(action.entry.name)
          } else {
            skipped.push(action.entry.name)
          }
        }

        if (actions.some(a => a.action === 'add')) {
          mkdirSync(config.customDir, { recursive: true })
          writeFileSync(config.customRegistry, JSON.stringify(existingCustomReg, null, 2), 'utf8')
        }
      }

      if (validation.debugRegistry) {
        const existingParsed = existingDebugReg.templates.map(e => parseRegistry({ templates: [e] }).templates[0])
        const actions = computeMergeActions(validation.debugRegistry.templates, existingParsed)

        for (const action of actions) {
          if (action.action === 'add') {
            existingDebugReg.templates.push(action.entry)
            const shortName = action.entry.filename.replace(/^debug\//, '')
            const tplPath = `debug/${shortName}.template`
            if (files[tplPath]) {
              mkdirSync(config.debugDir, { recursive: true })
              const outPath = resolve(config.debugDir, `${shortName}.template`)
              assertWithin(config.debugDir, outPath)
              writeFileSync(outPath, Buffer.from(files[tplPath]))
            }
            added.push(action.entry.name)
          } else {
            skipped.push(action.entry.name)
          }
        }

        if (actions.some(a => a.action === 'add')) {
          mkdirSync(config.debugDir, { recursive: true })
          writeFileSync(config.debugRegistry, JSON.stringify(existingDebugReg, null, 2), 'utf8')
        }
      }
    }

    // Restore deployed manifest if present in backup
    const deployedManifestData = files['manifests/.deployed-manifest']
    if (deployedManifestData) {
      try {
        mkdirSync(config.rmMethodsBackupDir, { recursive: true })
        writeFileSync(config.rmMethodsDeployedManifest, Buffer.from(deployedManifestData))
      } catch { /* best effort */ }
    }

    // Restore rm-methods-dist files (UUID triplets + manifest) if present
    const rmMethodsDistFiles = Object.keys(files).filter(k => k.startsWith('rm-methods-dist/'))
    if (rmMethodsDistFiles.length > 0) {
      mkdirSync(config.rmMethodsDistDir, { recursive: true })
      for (const path of rmMethodsDistFiles) {
        const filename = basename(path)
        if (!filename) continue
        const outPath = resolve(config.rmMethodsDistDir, filename)
        assertWithin(config.rmMethodsDistDir, outPath)
        writeFileSync(outPath, Buffer.from(files[path]))
      }
    }

    return reply.send({ ok: true, added, skipped, removed, warnings: validation.warnings })
  })

  // POST /api/restore/preview — dry-run: show what merge would add/skip and what replace would remove
  app.post('/api/restore/preview', async (request, reply) => {
    const rawBody = await request.body as Buffer
    if (rawBody.length > 50 * 1024 * 1024) {
      return reply.status(400).send({ error: 'Backup file too large (max 50MB)' })
    }

    const unzipped = unzipSync(new Uint8Array(rawBody))
    const files: Record<string, Uint8Array> = {}
    for (const [k, v] of Object.entries(unzipped)) {
      files[k] = v
    }

    const validation = validateBackupContents(files)
    if (!validation.valid) {
      return reply.status(400).send({ error: 'Invalid backup', details: validation.errors })
    }

    // Read existing registries
    let existingCustomReg: { templates: Array<{ filename: string; name?: string; rmMethodsId?: string }> } = { templates: [] }
    let existingDebugReg: { templates: Array<{ filename: string; name?: string; rmMethodsId?: string }> } = { templates: [] }
    try { existingCustomReg = JSON.parse(readFileSync(config.customRegistry, 'utf8')) as typeof existingCustomReg } catch { /* empty */ }
    try { existingDebugReg = JSON.parse(readFileSync(config.debugRegistry, 'utf8')) as typeof existingDebugReg } catch { /* empty */ }

    // Compute merge actions to determine what would be added vs skipped
    const mergeAdded: string[] = []
    const mergeSkipped: string[] = []

    if (validation.customRegistry) {
      const existingParsed = existingCustomReg.templates.map(e => parseRegistry({ templates: [e] }).templates[0])
      const actions = computeMergeActions(validation.customRegistry.templates, existingParsed)
      for (const a of actions) {
        if (a.action === 'add') mergeAdded.push(a.entry.name)
        else mergeSkipped.push(a.entry.name)
      }
    }
    if (validation.debugRegistry) {
      const existingParsed = existingDebugReg.templates.map(e => parseRegistry({ templates: [e] }).templates[0])
      const actions = computeMergeActions(validation.debugRegistry.templates, existingParsed)
      for (const a of actions) {
        if (a.action === 'add') mergeAdded.push(a.entry.name)
        else mergeSkipped.push(a.entry.name)
      }
    }

    // Compute what a replace would remove (local templates not in the backup)
    const incomingCustomNames = new Set(validation.customRegistry?.templates.map(t => t.name) ?? [])
    const incomingDebugNames = new Set(validation.debugRegistry?.templates.map(t => t.name) ?? [])

    const wouldRemove: Array<{ name: string; filename: string; collection: 'custom' | 'debug' }> = []
    for (const t of existingCustomReg.templates) {
      const name = t.name ?? t.filename
      if (!incomingCustomNames.has(name)) {
        wouldRemove.push({ name, filename: t.filename, collection: 'custom' })
      }
    }
    for (const t of existingDebugReg.templates) {
      const name = t.name ?? t.filename
      if (!incomingDebugNames.has(name)) {
        wouldRemove.push({ name, filename: t.filename, collection: 'debug' })
      }
    }

    return reply.send({
      ok: true,
      mergeAdded,
      mergeSkipped,
      wouldRemove,
      warnings: validation.warnings,
      incomingCount: (validation.customRegistry?.templates.length ?? 0) + (validation.debugRegistry?.templates.length ?? 0),
    })
  })

  // POST /api/restore/cleanup — delete specific local templates by filename after a restore
  app.post('/api/restore/cleanup', async (request, reply) => {
    const body = request.body as { templates: Array<{ filename: string; collection: 'custom' | 'debug' }> }
    if (!Array.isArray(body?.templates)) {
      return reply.status(400).send({ error: 'Expected { templates: [...] }' })
    }

    const removed: string[] = []

    for (const entry of body.templates) {
      const dir = entry.collection === 'custom' ? config.customDir : config.debugDir
      const registryPath = entry.collection === 'custom' ? config.customRegistry : config.debugRegistry

      // Remove from registry
      try {
        const raw = JSON.parse(readFileSync(registryPath, 'utf8')) as { templates: Array<{ filename: string; name?: string }> }
        const before = raw.templates.length
        raw.templates = raw.templates.filter(t => t.filename !== entry.filename)
        if (raw.templates.length < before) {
          writeFileSync(registryPath, JSON.stringify(raw, null, 2), 'utf8')
        }
      } catch { /* registry doesn't exist */ }

      // Remove .template file
      const shortName = entry.filename.replace(new RegExp(`^${entry.collection}/`), '')
      const tplPath = resolve(dir, `${shortName}.template`)
      try {
        assertWithin(dir, tplPath)
        if (existsSync(tplPath)) {
          const { unlinkSync } = await import('node:fs')
          unlinkSync(tplPath)
        }
      } catch { /* best effort */ }

      removed.push(entry.filename)
    }

    return reply.send({ ok: true, removed })
  })

  // GET /api/backups — list server-side app backup ZIPs
  app.get('/api/backups', async (_request, reply) => {
    if (!existsSync(config.appBackupsDir)) {
      return reply.send({ backups: [] })
    }

    const entries = readdirSync(config.appBackupsDir)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const filePath = resolve(config.appBackupsDir, f)
        const stat = statSync(filePath)
        return {
          filename: f,
          created: stat.mtime.toISOString(),
          size: stat.size,
        }
      })
      .sort((a, b) => b.created.localeCompare(a.created))

    return reply.send({ backups: entries })
  })

  // POST /api/restore-from-backup/:filename — restore from a server-side backup ZIP
  app.post<{ Params: { filename: string } }>('/api/restore-from-backup/:filename', async (request, reply) => {
    const { filename } = request.params
    if (!filename.endsWith('.zip') || filename.includes('/') || filename.includes('..')) {
      return reply.status(400).send({ error: 'Invalid backup filename' })
    }

    const backupPath = resolve(config.appBackupsDir, filename)
    assertWithin(config.appBackupsDir, backupPath)

    if (!existsSync(backupPath)) {
      return reply.status(404).send({ error: 'Backup not found' })
    }

    // Read the ZIP and forward to the same restore logic via internal redirect
    const rawBody = readFileSync(backupPath)
    const mode = (request.query as Record<string, string>).mode ?? 'merge'

    // Inject the body and simulate a restore request
    const restoreRes = await app.inject({
      method: 'POST',
      url: `/api/restore?mode=${mode}`,
      headers: { 'content-type': 'application/zip' },
      payload: rawBody,
    })

    return reply.status(restoreRes.statusCode).send(restoreRes.json())
  })

  // GET /api/backups/:filename/download — download a server-side backup ZIP (for preview/restore)
  app.get<{ Params: { filename: string } }>('/api/backups/:filename/download', async (request, reply) => {
    const { filename } = request.params
    if (!filename.endsWith('.zip') || filename.includes('/') || filename.includes('..')) {
      return reply.status(400).send({ error: 'Invalid backup filename' })
    }

    const backupPath = resolve(config.appBackupsDir, filename)
    assertWithin(config.appBackupsDir, backupPath)

    if (!existsSync(backupPath)) {
      return reply.status(404).send({ error: 'Backup not found' })
    }

    const data = readFileSync(backupPath)
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .header('content-length', String(data.length))
      .send(data)
  })

  // DELETE /api/backups/:filename — delete a server-side backup ZIP
  app.delete<{ Params: { filename: string } }>('/api/backups/:filename', async (request, reply) => {
    const { filename } = request.params
    if (!filename.endsWith('.zip') || filename.includes('/') || filename.includes('..')) {
      return reply.status(400).send({ error: 'Invalid backup filename' })
    }

    const backupPath = resolve(config.appBackupsDir, filename)
    assertWithin(config.appBackupsDir, backupPath)

    if (!existsSync(backupPath)) {
      return reply.status(404).send({ error: 'Backup not found' })
    }

    const { unlinkSync } = await import('node:fs')
    unlinkSync(backupPath)
    return reply.send({ ok: true })
  })
}
