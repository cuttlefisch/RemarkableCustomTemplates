// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { zipSync, strToU8 } from 'fflate'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `removeall-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(base, 'public/templates/custom'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/debug'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/methods'), { recursive: true })
  mkdirSync(resolve(base, 'remarkable_official_templates'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-dist'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-backups'), { recursive: true })
  mkdirSync(resolve(base, 'data/ssh'), { recursive: true })
  return resolveConfig({ dataDir: base, port: 0, production: false })
}

describe('remove-all routes', () => {
  let config: ServerConfig

  beforeEach(() => {
    config = makeConfig()
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  describe('GET /api/device/remove-all-backup/:filename', () => {
    it('serves a ZIP file from the backups directory', async () => {
      const zipData = zipSync({ 'test.txt': strToU8('hello') })
      writeFileSync(resolve(config.rmMethodsBackupDir, 'remove-all-backup-20260318_120000.zip'), zipData)

      const app = await createApp(config)
      const res = await app.inject({
        method: 'GET',
        url: '/api/device/remove-all-backup/remove-all-backup-20260318_120000.zip',
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')
      expect(res.headers['content-disposition']).toContain('attachment')
      await app.close()
    })

    it('rejects path traversal attempts', async () => {
      const app = await createApp(config)
      // Fastify normalizes ../.. out of the URL, so use encoded dots
      const res = await app.inject({
        method: 'GET',
        url: '/api/device/remove-all-backup/..%2F..%2Fetc%2Fpasswd',
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('returns 404 for nonexistent files', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'GET',
        url: '/api/device/remove-all-backup/nonexistent.zip',
      })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('POST /api/device/remove-all-preview', () => {
    it('returns 400 when device is not configured', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/device/remove-all-preview',
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toContain('not configured')
      await app.close()
    })
  })

  describe('POST /api/device/remove-all-execute', () => {
    it('returns 400 when device is not configured', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/device/remove-all-execute',
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toContain('not configured')
      await app.close()
    })
  })
})
