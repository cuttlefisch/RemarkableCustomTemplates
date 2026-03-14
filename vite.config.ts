import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync, readdirSync } from 'node:fs'
import { resolveStringConstants } from './src/lib/customTemplates'
import { resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { zipSync, strToU8 } from 'fflate'

const OFFICIAL_DIR = resolve(__dirname, 'remarkable_official_templates')
const CUSTOM_DIR = resolve(__dirname, 'public/templates/custom')
const CUSTOM_REGISTRY = resolve(CUSTOM_DIR, 'custom-registry.json')
const DEBUG_DIR = resolve(__dirname, 'public/templates/debug')
const DEBUG_REGISTRY = resolve(DEBUG_DIR, 'debug-registry.json')

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
    req.on('end', () => res(data))
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

          let filePath: string
          try {
            filePath = resolve(OFFICIAL_DIR, filename)
            assertWithin(OFFICIAL_DIR, filePath)
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid path' }))
            return
          }

          // templates.json: serve debug entries even without official templates
          if (filename === 'templates.json') {
            const debugTemplates = existsSync(DEBUG_REGISTRY)
              ? (JSON.parse(readFileSync(DEBUG_REGISTRY, 'utf8')) as { templates: unknown[] }).templates
              : []
            if (existsSync(filePath)) {
              const officialReg = JSON.parse(readFileSync(filePath, 'utf8')) as { templates: unknown[] }
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ templates: [...debugTemplates, ...officialReg.templates] }, null, 2))
            } else if (debugTemplates.length > 0) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ templates: debugTemplates }, null, 2))
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
            registry.templates = (registry.templates as Array<{ filename: string }>).map(e =>
              e.filename === `custom/${filename}` ? body.entry : e,
            )
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
