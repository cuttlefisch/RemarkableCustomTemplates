import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

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

      next()
    })
  },
}

// https://vite.dev/config/
// Template files are served from public/templates/ (copied from templates_orig/).
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
