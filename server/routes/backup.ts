/**
 * GET /api/backup — export backup ZIP
 * POST /api/restore — import backup ZIP
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
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
          } catch { /* skip broken */ }
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
          } catch { /* skip broken */ }
        }
      }
    }

    const zipped = zipSync(fileMap)
    const now = new Date()
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="remarkable-backup-${dateStr}.zip"`)
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

    if (mode === 'replace') {
      let oldCustom: string | null = null
      let oldDebug: string | null = null
      try { oldCustom = readFileSync(config.customRegistry, 'utf8') } catch { /* empty */ }
      try { oldDebug = readFileSync(config.debugRegistry, 'utf8') } catch { /* empty */ }

      try {
        if (validation.customRegistry) {
          mkdirSync(config.customDir, { recursive: true })
          writeFileSync(config.customRegistry, JSON.stringify({ templates: validation.customRegistry.templates }, null, 2), 'utf8')
          for (const path of validation.customTemplateFiles) {
            const filename = path.replace('custom/', '')
            const outPath = resolve(config.customDir, filename)
            assertWithin(config.customDir, outPath)
            writeFileSync(outPath, Buffer.from(files[path]))
            added.push(path)
          }
        }

        if (validation.debugRegistry) {
          mkdirSync(config.debugDir, { recursive: true })
          writeFileSync(config.debugRegistry, JSON.stringify({ templates: validation.debugRegistry.templates }, null, 2), 'utf8')
          for (const path of validation.debugTemplateFiles) {
            const filename = path.replace('debug/', '')
            const outPath = resolve(config.debugDir, filename)
            assertWithin(config.debugDir, outPath)
            writeFileSync(outPath, Buffer.from(files[path]))
            added.push(path)
          }
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

    return reply.send({ ok: true, added, skipped, warnings: validation.warnings })
  })
}
