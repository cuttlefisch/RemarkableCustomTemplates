import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { zipSync, strToU8 } from 'fflate'

const OFFICIAL_DIR = resolve(__dirname, 'remarkable_official_templates')
const CUSTOM_DIR = resolve(__dirname, 'public/templates/custom')
const CUSTOM_REGISTRY = resolve(CUSTOM_DIR, 'custom-registry.json')

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

      // GET /templates/* (not /templates/custom/*) — serve from OFFICIAL_DIR
      if (req.method === 'GET') {
        const officialMatch = url.match(/^\/templates\/(?!custom\/)(.+)$/)
        if (officialMatch) {
          const filename = decodeURIComponent(officialMatch[1])
          const filePath = resolve(OFFICIAL_DIR, filename)
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
            writeFileSync(resolve(OFFICIAL_DIR, name), content, 'utf8')
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

          const mergedRegistry = {
            ...officialRegistry,
            templates: [...officialRegistry.templates, ...customEntries],
          }

          // Build zip file map
          const fileMap: Record<string, Uint8Array> = {}
          fileMap['templates.json'] = strToU8(JSON.stringify(mergedRegistry, null, 2))

          // Add official template files
          for (const file of readdirSync(OFFICIAL_DIR)) {
            if (file.endsWith('.template')) {
              fileMap[file] = readFileSync(resolve(OFFICIAL_DIR, file))
            }
          }

          // Add custom template files
          if (existsSync(CUSTOM_DIR)) {
            for (const file of readdirSync(CUSTOM_DIR)) {
              if (file.endsWith('.template')) {
                const flatName = file
                if (!fileMap[flatName]) {
                  fileMap[flatName] = readFileSync(resolve(CUSTOM_DIR, file))
                }
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
          writeFileSync(newPath, content, 'utf8')
          if (newSlug !== oldSlug) {
            const oldPath = resolve(CUSTOM_DIR, `${oldSlug}.template`)
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
