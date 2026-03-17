import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolveStringConstants } from './src/lib/customTemplates'
import { generateTemplateIcon } from './src/lib/iconGenerator'
import {
  templateContentHash,
  resolveTemplateVersion,
  buildRmMethodsMetadata,
  type ManifestEntry,
  type RmMethodsManifest,
} from './src/lib/rmMethods'
import { parseTemplate } from './src/lib/parser'
import { buildBackupManifest, validateBackupContents, computeMergeActions } from './src/lib/backup'
import { parseRegistry } from './src/lib/registry'
import { resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { zipSync, unzipSync, strToU8 } from 'fflate'

const OFFICIAL_DIR = resolve(__dirname, 'remarkable_official_templates')
const CUSTOM_DIR = resolve(__dirname, 'public/templates/custom')
const CUSTOM_REGISTRY = resolve(CUSTOM_DIR, 'custom-registry.json')
const DEBUG_DIR = resolve(__dirname, 'public/templates/debug')
const DEBUG_REGISTRY = resolve(DEBUG_DIR, 'debug-registry.json')
const METHODS_DIR = resolve(__dirname, 'public/templates/methods')
const METHODS_REGISTRY = resolve(METHODS_DIR, 'methods-registry.json')

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
    req.on('end', () => res(data))
    req.on('error', rej)
  })
}

function readBinaryBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => res(Buffer.concat(chunks)))
    req.on('error', rej)
  })
}

function readRegistry(): { templates: unknown[] } {
  try {
    return JSON.parse(readFileSync(CUSTOM_REGISTRY, 'utf8')) as { templates: unknown[] }
  } catch {
    return { templates: [] }
  }
}

function assertWithin(base: string, resolved: string): void {
  if (!resolved.startsWith(base + sep) && resolved !== base) {
    throw new Error(`Path traversal attempt rejected: ${resolved}`)
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(json)
}

const customTemplatesPlugin: Plugin = {
  name: 'custom-templates-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url ?? ''

      // GET /templates/* (not /templates/custom/*) — serve from OFFICIAL_DIR or DEBUG_DIR
      if (req.method === 'GET') {
        const officialMatch = url.match(/^\/templates\/(?!custom\/)(.+)$/)
        if (officialMatch) {
          const filename = decodeURIComponent(officialMatch[1])

          // Serve debug templates from public/templates/debug/
          const debugMatch = filename.match(/^debug\/(.+)$/)
          if (debugMatch) {
            const debugFile = debugMatch[1]
            let debugPath: string
            try {
              debugPath = resolve(DEBUG_DIR, debugFile)
              assertWithin(DEBUG_DIR, debugPath)
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Invalid path' }))
              return
            }
            const ct = debugFile.endsWith('.json') ? 'application/json' : 'application/octet-stream'
            if (existsSync(debugPath)) {
              res.writeHead(200, { 'Content-Type': ct })
              res.end(readFileSync(debugPath))
              return
            }
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Not found' }))
            return
          }

          // Serve methods templates from public/templates/methods/
          const methodsMatch = filename.match(/^methods\/(.+)$/)
          if (methodsMatch) {
            const methodsFile = methodsMatch[1]
            let methodsPath: string
            try {
              methodsPath = resolve(METHODS_DIR, methodsFile)
              assertWithin(METHODS_DIR, methodsPath)
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Invalid path' }))
              return
            }
            const ct = methodsFile.endsWith('.json') ? 'application/json' : 'application/octet-stream'
            if (existsSync(methodsPath)) {
              res.writeHead(200, { 'Content-Type': ct })
              res.end(readFileSync(methodsPath))
              return
            }
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Not found' }))
            return
          }

          let filePath: string
          try {
            filePath = resolve(OFFICIAL_DIR, filename)
            assertWithin(OFFICIAL_DIR, filePath)
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid path' }))
            return
          }

          // templates.json: serve debug + methods + official entries
          if (filename === 'templates.json') {
            const debugTemplates = existsSync(DEBUG_REGISTRY)
              ? (JSON.parse(readFileSync(DEBUG_REGISTRY, 'utf8')) as { templates: unknown[] }).templates
              : []
            const methodsTemplates = existsSync(METHODS_REGISTRY)
              ? (JSON.parse(readFileSync(METHODS_REGISTRY, 'utf8')) as { templates: unknown[] }).templates
              : []
            const hasOfficial = existsSync(filePath)
            const officialTemplates = hasOfficial
              ? (JSON.parse(readFileSync(filePath, 'utf8')) as { templates: unknown[] }).templates
              : []
            const allTemplates = [...debugTemplates, ...methodsTemplates, ...officialTemplates]
            if (allTemplates.length > 0 || hasOfficial) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ templates: allTemplates }, null, 2))
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Not found' }))
            }
            return
          }

          if (existsSync(filePath)) {
            const content = readFileSync(filePath)
            const ct = filename.endsWith('.json') ? 'application/json' : 'application/octet-stream'
            res.writeHead(200, { 'Content-Type': ct })
            res.end(content)
            return
          }
          // Not found in official dir — fall through to 404
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Not found' }))
          return
        }
      }

      // POST /api/save-official-templates — write files to OFFICIAL_DIR
      if (req.method === 'POST' && url === '/api/save-official-templates') {
        try {
          const body = JSON.parse(await readBody(req)) as {
            files: Array<{ name: string; content: string }>
          }
          if (!body.files.some(f => f.name === 'templates.json')) {
            sendJson(res, 400, { error: 'templates.json must be included' })
            return
          }
          mkdirSync(OFFICIAL_DIR, { recursive: true })
          for (const { name, content } of body.files) {
            const filePath = resolve(OFFICIAL_DIR, name)
            assertWithin(OFFICIAL_DIR, filePath)
            writeFileSync(filePath, content, 'utf8')
          }
          sendJson(res, 200, { ok: true, count: body.files.length })
        } catch (e) {
          sendJson(res, 400, { error: String(e) })
        }
        return
      }

      // GET /api/export-templates — zip official + custom templates with merged registry
      if (req.method === 'GET' && url === '/api/export-templates') {
        try {
          const officialRegistryPath = resolve(OFFICIAL_DIR, 'templates.json')
          if (!existsSync(officialRegistryPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Official templates not loaded. Copy files to remarkable_official_templates/ first.' }))
            return
          }

          const officialRegistry = JSON.parse(readFileSync(officialRegistryPath, 'utf8')) as { templates: Array<{ filename: string }> }
          let customRegistry: { templates: Array<{ filename: string }> } = { templates: [] }
          try {
            customRegistry = JSON.parse(readFileSync(CUSTOM_REGISTRY, 'utf8')) as { templates: Array<{ filename: string }> }
          } catch { /* no custom templates */ }

          // Load debug registry
          let debugRegistry: { templates: Array<{ filename: string }> } = { templates: [] }
          try { debugRegistry = JSON.parse(readFileSync(DEBUG_REGISTRY, 'utf8')) as { templates: Array<{ filename: string }> } } catch { /* empty */ }
          const debugEntries = debugRegistry.templates.map(e => ({ ...e, filename: e.filename.replace(/^debug\//, '') }))
          const debugFilenames = new Set(debugEntries.map(e => e.filename))

          // Flatten custom filenames (strip "custom/" prefix) and check for collisions
          const officialFilenames = new Set(officialRegistry.templates.map(e => e.filename))
          const warningFiles: string[] = []
          const customEntries = customRegistry.templates
            .map(e => ({ ...e, filename: e.filename.replace(/^custom\//, '') }))
            .filter(e => {
              if (officialFilenames.has(e.filename)) {
                warningFiles.push(e.filename)
                return false
              }
              return true
            })

          // Sync categories from each custom .template file (source of truth for tags like "Dark")
          const syncedCustomEntries = customEntries.map(entry => {
            const tplPath = resolve(CUSTOM_DIR, `${entry.filename}.template`)
            if (existsSync(tplPath)) {
              try {
                const tpl = JSON.parse(readFileSync(tplPath, 'utf8')) as { categories?: unknown }
                if (Array.isArray(tpl.categories)) {
                  return { ...entry, categories: ['Custom', ...tpl.categories.filter((c: unknown) => c !== 'Custom')] }
                }
              } catch { /* ignore, keep registry categories */ }
            }
            return entry
          })

          const filteredOfficial = officialRegistry.templates.filter(e => !debugFilenames.has(e.filename))
          const mergedRegistry = {
            ...officialRegistry,
            templates: [...debugEntries, ...filteredOfficial, ...syncedCustomEntries],
          }

          // Escape non-ASCII chars as \uXXXX to match device JSON format
          function escapeUnicode(str: string): string {
            return str.replace(/[\u0080-\uFFFF]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
          }

          // Build zip file map
          const fileMap: Record<string, Uint8Array> = {}
          fileMap['templates.json'] = strToU8(escapeUnicode(JSON.stringify(mergedRegistry, null, 2)))

          // Add official template files
          for (const file of readdirSync(OFFICIAL_DIR)) {
            if (file.endsWith('.template')) {
              fileMap[file] = readFileSync(resolve(OFFICIAL_DIR, file))
            }
          }

          // Add custom template files (resolve named color references for device compatibility)
          if (existsSync(CUSTOM_DIR)) {
            for (const file of readdirSync(CUSTOM_DIR)) {
              if (file.endsWith('.template')) {
                const flatName = file
                if (!fileMap[flatName]) {
                  const raw = readFileSync(resolve(CUSTOM_DIR, file), 'utf8')
                  fileMap[flatName] = strToU8(resolveStringConstants(raw))
                }
              }
            }
          }

          // Add debug template files
          if (existsSync(DEBUG_DIR)) {
            for (const entry of debugEntries) {
              const shortName = entry.filename
              const filePath = resolve(DEBUG_DIR, `${shortName}.template`)
              if (existsSync(filePath) && !fileMap[`${shortName}.template`]) {
                fileMap[`${shortName}.template`] = strToU8(resolveStringConstants(readFileSync(filePath, 'utf8')))
              }
            }
          }

          const zipped = zipSync(fileMap)
          const headers: Record<string, string> = {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="remarkable-templates.zip"',
            'Content-Length': String(zipped.length),
          }
          if (warningFiles.length > 0) {
            headers['X-Skipped-Files'] = warningFiles.join(', ')
          }
          res.writeHead(200, headers)
          res.end(Buffer.from(zipped))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(e) }))
        }
        return
      }

      // GET /api/export-rm-methods — zip custom + debug templates in rm_methods UUID format
      if (req.method === 'GET' && url === '/api/export-rm-methods') {
        try {
          // Load registries (no official templates required)
          let customReg: { templates: Array<{ filename: string; name: string; landscape?: boolean; categories: string[]; rmMethodsId?: string }> } = { templates: [] }
          let debugReg:  { templates: Array<{ filename: string; name: string; landscape?: boolean; categories: string[]; rmMethodsId?: string }> } = { templates: [] }
          try { customReg = JSON.parse(readFileSync(CUSTOM_REGISTRY, 'utf8')) as typeof customReg } catch { /* no custom */ }
          try { debugReg  = JSON.parse(readFileSync(DEBUG_REGISTRY,  'utf8')) as typeof debugReg  } catch { /* no debug  */ }

          // Ensure every entry has a persisted UUID; write back registries if any were added
          let customDirty = false
          let debugDirty  = false
          for (const entry of customReg.templates) {
            if (!entry.rmMethodsId) { entry.rmMethodsId = randomUUID(); customDirty = true }
          }
          for (const entry of debugReg.templates) {
            if (!entry.rmMethodsId) { entry.rmMethodsId = randomUUID(); debugDirty = true }
          }
          if (customDirty) writeFileSync(CUSTOM_REGISTRY, JSON.stringify(customReg, null, 2), 'utf8')
          if (debugDirty)  writeFileSync(DEBUG_REGISTRY,  JSON.stringify(debugReg,  null, 2), 'utf8')

          // Load previous manifest for version tracking
          const MANIFEST_PATH = resolve(__dirname, 'rm-methods-dist/.manifest')
          let prevManifest: RmMethodsManifest = { exportedAt: '', templates: {} }
          try { prevManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as RmMethodsManifest } catch { /* first export */ }

          const nowMs = String(Date.now())
          const fileMap: Record<string, Uint8Array> = {}
          const manifestTemplates: Record<string, ManifestEntry> = {}

          function addEntry(
            entry: { filename: string; name: string; landscape?: boolean; categories: string[]; rmMethodsId?: string },
            templateDir: string,
            filePrefix: string,
          ) {
            const uuid = entry.rmMethodsId!
            const shortName = entry.filename.replace(new RegExp(`^${filePrefix}/`), '')
            const tplPath = resolve(templateDir, `${shortName}.template`)
            if (!existsSync(tplPath)) return

            const rawContent = readFileSync(tplPath, 'utf8')
            const resolvedContent = resolveStringConstants(rawContent)

            // Parse template to generate icon and read fields
            let iconData: string | undefined
            let labels: string[]
            try {
              const tplObj = JSON.parse(resolvedContent) as Record<string, unknown>
              const tpl = parseTemplate(tplObj)
              iconData = generateTemplateIcon(tpl)
              labels = (tpl.labels ?? tpl.categories ?? ['Custom']).filter((l: string) => l.length > 0)
              if (labels.length === 0) labels = ['Custom']

              // Embed iconData and labels into the template file
              const enriched: Record<string, unknown> = { ...tplObj, iconData, labels }

              // Compute content hash and resolve version
              const contentHash = templateContentHash(enriched)
              const prevEntry = prevManifest.templates[uuid]
              const sourceVersion = typeof tplObj.templateVersion === 'string' ? tplObj.templateVersion : '1.0.0'
              const resolvedVersion = resolveTemplateVersion({ prevEntry, currentHash: contentHash, sourceVersion })
              enriched.templateVersion = resolvedVersion

              fileMap[`${uuid}.template`] = strToU8(JSON.stringify(enriched, null, 2))

              // Collect manifest entry
              manifestTemplates[uuid] = {
                name: entry.name,
                templateVersion: resolvedVersion,
                contentHash,
                createdTime: prevEntry?.createdTime ?? nowMs,
              }
            } catch {
              // If parsing fails, include the raw resolved content without enrichment
              fileMap[`${uuid}.template`] = strToU8(resolvedContent)
              labels = (entry.categories ?? ['Custom']).filter((l: string) => l.length > 0)
              if (labels.length === 0) labels = ['Custom']

              manifestTemplates[uuid] = {
                name: entry.name,
                templateVersion: '1.0.0',
                contentHash: 'sha256:unknown',
                createdTime: prevManifest.templates[uuid]?.createdTime ?? nowMs,
              }
            }

            // {uuid}.metadata — official xochitl TemplateType format
            const metadata = buildRmMethodsMetadata({
              visibleName: entry.name,
              createdTime: prevManifest.templates[uuid]?.createdTime ?? manifestTemplates[uuid]?.createdTime,
              nowMs,
            })
            fileMap[`${uuid}.metadata`] = strToU8(JSON.stringify(metadata, null, 2))

            // {uuid}.content
            fileMap[`${uuid}.content`] = strToU8('{}')
          }

          for (const entry of customReg.templates) addEntry(entry, CUSTOM_DIR, 'custom')
          for (const entry of debugReg.templates)  addEntry(entry, DEBUG_DIR,  'debug')

          // Write JSON manifest into ZIP
          const manifest: RmMethodsManifest = { exportedAt: nowMs, templates: manifestTemplates }
          fileMap['.manifest'] = strToU8(JSON.stringify(manifest, null, 2))

          const zipped = zipSync(fileMap)
          res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="remarkable-rm-methods.zip"',
            'Content-Length': String(zipped.length),
          })
          res.end(Buffer.from(zipped))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(e) }))
        }
        return
      }

      // GET /api/backup — export backup ZIP of custom + debug templates
      if (req.method === 'GET' && url === '/api/backup') {
        try {
          let customReg: { templates: unknown[] } = { templates: [] }
          let debugReg: { templates: unknown[] } = { templates: [] }
          try { customReg = JSON.parse(readFileSync(CUSTOM_REGISTRY, 'utf8')) as typeof customReg } catch { /* empty */ }
          try { debugReg = JSON.parse(readFileSync(DEBUG_REGISTRY, 'utf8')) as typeof debugReg } catch { /* empty */ }

          const manifest = buildBackupManifest(customReg.templates.length, debugReg.templates.length)
          const fileMap: Record<string, Uint8Array> = {}
          fileMap['backup-manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))

          if (customReg.templates.length > 0) {
            fileMap['custom/custom-registry.json'] = strToU8(JSON.stringify(customReg, null, 2))
          }
          if (debugReg.templates.length > 0) {
            fileMap['debug/debug-registry.json'] = strToU8(JSON.stringify(debugReg, null, 2))
          }

          // Add custom template files as-is (no resolveStringConstants)
          if (existsSync(CUSTOM_DIR)) {
            for (const file of readdirSync(CUSTOM_DIR)) {
              if (file.endsWith('.template')) {
                fileMap[`custom/${file}`] = readFileSync(resolve(CUSTOM_DIR, file))
              }
            }
          }

          // Add debug template files as-is
          if (existsSync(DEBUG_DIR)) {
            for (const file of readdirSync(DEBUG_DIR)) {
              if (file.endsWith('.template')) {
                fileMap[`debug/${file}`] = readFileSync(resolve(DEBUG_DIR, file))
              }
            }
          }

          const zipped = zipSync(fileMap)
          const dateStr = new Date().toISOString().slice(0, 10)
          res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="remarkable-backup-${dateStr}.zip"`,
            'Content-Length': String(zipped.length),
          })
          res.end(Buffer.from(zipped))
        } catch (e) {
          sendJson(res, 500, { error: String(e) })
        }
        return
      }

      // POST /api/restore?mode=merge|replace — import backup ZIP
      if (req.method === 'POST' && url.startsWith('/api/restore')) {
        try {
          const urlObj = new URL(url, 'http://localhost')
          const mode = urlObj.searchParams.get('mode') ?? 'merge'
          if (mode !== 'merge' && mode !== 'replace') {
            sendJson(res, 400, { error: `Invalid mode: "${mode}" (expected "merge" or "replace")` })
            return
          }

          const body = await readBinaryBody(req)
          if (body.length > 50 * 1024 * 1024) {
            sendJson(res, 400, { error: 'Backup file too large (max 50MB)' })
            return
          }

          const unzipped = unzipSync(new Uint8Array(body))
          const files: Record<string, Uint8Array> = {}
          for (const [k, v] of Object.entries(unzipped)) {
            files[k] = v
          }

          const validation = validateBackupContents(files)
          if (!validation.valid) {
            sendJson(res, 400, { error: 'Invalid backup', details: validation.errors })
            return
          }

          const added: string[] = []
          const skipped: string[] = []

          if (mode === 'replace') {
            // Save old registries for rollback on failure
            let oldCustom: string | null = null
            let oldDebug: string | null = null
            try { oldCustom = readFileSync(CUSTOM_REGISTRY, 'utf8') } catch { /* empty */ }
            try { oldDebug = readFileSync(DEBUG_REGISTRY, 'utf8') } catch { /* empty */ }

            try {
              // Write custom registry + templates
              if (validation.customRegistry) {
                mkdirSync(CUSTOM_DIR, { recursive: true })
                writeFileSync(CUSTOM_REGISTRY, JSON.stringify({ templates: validation.customRegistry.templates }, null, 2), 'utf8')
                for (const path of validation.customTemplateFiles) {
                  const filename = path.replace('custom/', '')
                  const outPath = resolve(CUSTOM_DIR, filename)
                  assertWithin(CUSTOM_DIR, outPath)
                  writeFileSync(outPath, Buffer.from(files[path]))
                  added.push(path)
                }
              }

              // Write debug registry + templates
              if (validation.debugRegistry) {
                mkdirSync(DEBUG_DIR, { recursive: true })
                writeFileSync(DEBUG_REGISTRY, JSON.stringify({ templates: validation.debugRegistry.templates }, null, 2), 'utf8')
                for (const path of validation.debugTemplateFiles) {
                  const filename = path.replace('debug/', '')
                  const outPath = resolve(DEBUG_DIR, filename)
                  assertWithin(DEBUG_DIR, outPath)
                  writeFileSync(outPath, Buffer.from(files[path]))
                  added.push(path)
                }
              }
            } catch (e) {
              // Attempt rollback
              try {
                if (oldCustom !== null) writeFileSync(CUSTOM_REGISTRY, oldCustom, 'utf8')
                if (oldDebug !== null) writeFileSync(DEBUG_REGISTRY, oldDebug, 'utf8')
              } catch { /* best effort */ }
              sendJson(res, 500, { error: `Restore failed: ${String(e)}` })
              return
            }
          } else {
            // Merge mode
            let existingCustomReg: { templates: Array<{ filename: string; rmMethodsId?: string }> } = { templates: [] }
            let existingDebugReg: { templates: Array<{ filename: string; rmMethodsId?: string }> } = { templates: [] }
            try { existingCustomReg = JSON.parse(readFileSync(CUSTOM_REGISTRY, 'utf8')) as typeof existingCustomReg } catch { /* empty */ }
            try { existingDebugReg = JSON.parse(readFileSync(DEBUG_REGISTRY, 'utf8')) as typeof existingDebugReg } catch { /* empty */ }

            // Merge custom
            if (validation.customRegistry) {
              const existingParsed = existingCustomReg.templates.map(e => parseRegistry({ templates: [e] }).templates[0])
              const actions = computeMergeActions(validation.customRegistry.templates, existingParsed)

              for (const action of actions) {
                if (action.action === 'add') {
                  existingCustomReg.templates.push(action.entry)
                  const shortName = action.entry.filename.replace(/^custom\//, '')
                  const tplPath = `custom/${shortName}.template`
                  if (files[tplPath]) {
                    mkdirSync(CUSTOM_DIR, { recursive: true })
                    const outPath = resolve(CUSTOM_DIR, `${shortName}.template`)
                    assertWithin(CUSTOM_DIR, outPath)
                    writeFileSync(outPath, Buffer.from(files[tplPath]))
                  }
                  added.push(action.entry.name)
                } else {
                  skipped.push(action.entry.name)
                }
              }

              if (actions.some(a => a.action === 'add')) {
                mkdirSync(CUSTOM_DIR, { recursive: true })
                writeFileSync(CUSTOM_REGISTRY, JSON.stringify(existingCustomReg, null, 2), 'utf8')
              }
            }

            // Merge debug
            if (validation.debugRegistry) {
              const existingParsed = existingDebugReg.templates.map(e => parseRegistry({ templates: [e] }).templates[0])
              const actions = computeMergeActions(validation.debugRegistry.templates, existingParsed)

              for (const action of actions) {
                if (action.action === 'add') {
                  existingDebugReg.templates.push(action.entry)
                  const shortName = action.entry.filename.replace(/^debug\//, '')
                  const tplPath = `debug/${shortName}.template`
                  if (files[tplPath]) {
                    mkdirSync(DEBUG_DIR, { recursive: true })
                    const outPath = resolve(DEBUG_DIR, `${shortName}.template`)
                    assertWithin(DEBUG_DIR, outPath)
                    writeFileSync(outPath, Buffer.from(files[tplPath]))
                  }
                  added.push(action.entry.name)
                } else {
                  skipped.push(action.entry.name)
                }
              }

              if (actions.some(a => a.action === 'add')) {
                mkdirSync(DEBUG_DIR, { recursive: true })
                writeFileSync(DEBUG_REGISTRY, JSON.stringify(existingDebugReg, null, 2), 'utf8')
              }
            }
          }

          sendJson(res, 200, { ok: true, added, skipped, warnings: validation.warnings })
        } catch (e) {
          sendJson(res, 400, { error: String(e) })
        }
        return
      }

      // POST /api/custom-templates — create new template
      if (req.method === 'POST' && url === '/api/custom-templates') {
        try {
          const body = JSON.parse(await readBody(req)) as {
            filename: string
            content: string
            entry: unknown
          }
          mkdirSync(CUSTOM_DIR, { recursive: true })
          const filePath = resolve(CUSTOM_DIR, `${body.filename}.template`)
          writeFileSync(filePath, body.content, 'utf8')

          const registry = readRegistry()
          registry.templates.push(body.entry)
          writeFileSync(CUSTOM_REGISTRY, JSON.stringify(registry, null, 2), 'utf8')

          sendJson(res, 201, { ok: true })
        } catch (e) {
          sendJson(res, 400, { error: String(e) })
        }
        return
      }

      // PUT /api/custom-templates/:filename — update existing template
      const putMatch = url.match(/^\/api\/custom-templates\/(.+)$/)
      if (req.method === 'PUT' && putMatch) {
        try {
          const filename = decodeURIComponent(putMatch[1])
          const body = JSON.parse(await readBody(req)) as {
            content: string
            entry?: unknown
          }
          const filePath = resolve(CUSTOM_DIR, `${filename}.template`)
          assertWithin(CUSTOM_DIR, filePath)
          writeFileSync(filePath, body.content, 'utf8')

          if (body.entry) {
            const registry = readRegistry()
            registry.templates = (registry.templates as Array<{ filename: string; rmMethodsId?: string }>).map(e => {
              if (e.filename !== `custom/${filename}`) return e
              const incoming = body.entry as Record<string, unknown>
              // Preserve rmMethodsId from existing entry if not in incoming
              if (e.rmMethodsId && !incoming.rmMethodsId) {
                return { ...incoming, rmMethodsId: e.rmMethodsId }
              }
              return body.entry
            })
            writeFileSync(CUSTOM_REGISTRY, JSON.stringify(registry, null, 2), 'utf8')
          }

          sendJson(res, 200, { ok: true })
        } catch (e) {
          sendJson(res, 400, { error: String(e) })
        }
        return
      }

      // PATCH /api/custom-templates/:oldSlug — rename + update existing template
      const patchMatch = url.match(/^\/api\/custom-templates\/(.+)$/)
      if (req.method === 'PATCH' && patchMatch) {
        try {
          const oldSlug = decodeURIComponent(patchMatch[1])
          const body = JSON.parse(await readBody(req)) as {
            newSlug: string
            newName: string
            content: string
          }
          const { newSlug, newName, content } = body
          mkdirSync(CUSTOM_DIR, { recursive: true })
          const newPath = resolve(CUSTOM_DIR, `${newSlug}.template`)
          assertWithin(CUSTOM_DIR, newPath)
          writeFileSync(newPath, content, 'utf8')
          if (newSlug !== oldSlug) {
            const oldPath = resolve(CUSTOM_DIR, `${oldSlug}.template`)
            assertWithin(CUSTOM_DIR, oldPath)
            if (existsSync(oldPath)) unlinkSync(oldPath)
          }
          const registry = readRegistry()
          registry.templates = (registry.templates as Array<{ filename: string; name: string }>).map(e =>
            e.filename === `custom/${oldSlug}`
              ? { ...e, name: newName, filename: `custom/${newSlug}` }
              : e,
          )
          writeFileSync(CUSTOM_REGISTRY, JSON.stringify(registry, null, 2), 'utf8')
          sendJson(res, 200, { ok: true })
        } catch (e) {
          sendJson(res, 400, { error: String(e) })
        }
        return
      }

      // DELETE /api/custom-templates/:slug — delete existing template
      const deleteMatch = url.match(/^\/api\/custom-templates\/(.+)$/)
      if (req.method === 'DELETE' && deleteMatch) {
        try {
          const slug = decodeURIComponent(deleteMatch[1])
          const filePath = resolve(CUSTOM_DIR, `${slug}.template`)
          assertWithin(CUSTOM_DIR, filePath)
          if (existsSync(filePath)) unlinkSync(filePath)
          const registry = readRegistry()
          registry.templates = (registry.templates as Array<{ filename: string }>).filter(
            e => e.filename !== `custom/${slug}`,
          )
          writeFileSync(CUSTOM_REGISTRY, JSON.stringify(registry, null, 2), 'utf8')
          sendJson(res, 200, { ok: true })
        } catch (e) {
          sendJson(res, 400, { error: String(e) })
        }
        return
      }

      next()
    })
  },
}

// https://vite.dev/config/
// Template files are served from public/templates/.
// Populate remarkable_official_templates/ from device, then copy into public/templates/.
export default defineConfig({
  plugins: [react(), customTemplatesPlugin],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
