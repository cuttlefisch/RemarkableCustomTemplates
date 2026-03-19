// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { zipSync, strToU8, unzipSync } from 'fflate'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'
import { writeDeviceStore } from '../lib/deviceStore.ts'

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `server-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(base, 'public/templates/custom'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/debug'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/methods'), { recursive: true })
  mkdirSync(resolve(base, 'remarkable_official_templates'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-dist'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-backups'), { recursive: true })
  mkdirSync(resolve(base, 'data/ssh'), { recursive: true })
  return resolveConfig({ dataDir: base, port: 0, production: false })
}

describe('server routes', () => {
  let config: ServerConfig

  beforeEach(() => {
    config = makeConfig()
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  describe('GET /templates/templates.json', () => {
    it('returns merged registry from debug + methods + official', async () => {
      writeFileSync(config.debugRegistry, JSON.stringify({
        templates: [{ name: 'Debug Template', filename: 'debug/test', iconCode: '\ue9d8', landscape: false, categories: ['Debug'] }],
      }))
      writeFileSync(resolve(config.officialDir, 'templates.json'), JSON.stringify({
        templates: [{ name: 'Official', filename: 'P Official', iconCode: '\ue9d8', landscape: false, categories: ['Lines'] }],
      }))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/templates/templates.json' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.templates).toHaveLength(2)
      expect(body.templates[0].name).toBe('Debug Template')
      expect(body.templates[1].name).toBe('Official')
      await app.close()
    })

    it('returns 404 when no templates exist', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/templates/templates.json' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('GET /templates/debug/*', () => {
    it('serves debug template files', async () => {
      const content = JSON.stringify({ name: 'Test' })
      writeFileSync(resolve(config.debugDir, 'test.template'), content)

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/templates/debug/test.template' })
      expect(res.statusCode).toBe(200)
      await app.close()
    })

    it('returns 404 for non-existent debug files', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/templates/debug/nope.template' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('POST /api/save-official-templates', () => {
    it('saves files to official dir', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/save-official-templates',
        payload: {
          files: [
            { name: 'templates.json', content: '{"templates":[]}' },
            { name: 'test.template', content: '{"name":"Test"}' },
          ],
        },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ ok: true, count: 2 })
      expect(existsSync(resolve(config.officialDir, 'templates.json'))).toBe(true)
      expect(existsSync(resolve(config.officialDir, 'test.template'))).toBe(true)
      await app.close()
    })

    it('rejects when templates.json is missing', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/save-official-templates',
        payload: { files: [{ name: 'other.template', content: '{}' }] },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('POST /api/custom-templates', () => {
    it('creates a new custom template', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/custom-templates',
        payload: {
          filename: 'P Test',
          content: '{"name":"Test"}',
          entry: { name: 'Test', filename: 'custom/P Test', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] },
        },
      })
      expect(res.statusCode).toBe(201)
      expect(existsSync(resolve(config.customDir, 'P Test.template'))).toBe(true)
      const registry = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(registry.templates).toHaveLength(1)
      await app.close()
    })
  })

  describe('DELETE /api/custom-templates/:slug', () => {
    it('deletes a custom template', async () => {
      // Setup
      writeFileSync(resolve(config.customDir, 'P Test.template'), '{"name":"Test"}')
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Test', filename: 'custom/P Test', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] }],
      }))

      const app = await createApp(config)
      const res = await app.inject({ method: 'DELETE', url: '/api/custom-templates/P Test' })
      expect(res.statusCode).toBe(200)
      expect(existsSync(resolve(config.customDir, 'P Test.template'))).toBe(false)
      const registry = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(registry.templates).toHaveLength(0)
      await app.close()
    })
  })

  describe('GET /api/devices', () => {
    it('returns empty list when no devices exist', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/devices' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.devices).toEqual([])
      expect(body.activeDeviceId).toBeNull()
      await app.close()
    })

    it('returns devices with redacted passwords', async () => {
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [{
          id: 'dev-1',
          nickname: 'My RM',
          deviceIp: '10.11.99.1',
          sshPort: 22,
          authMethod: 'password',
          sshPassword: 'secret123',
        }],
        activeDeviceId: 'dev-1',
      })

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/devices' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.devices).toHaveLength(1)
      expect(body.devices[0].deviceIp).toBe('10.11.99.1')
      expect(body.devices[0].sshPassword).toBe('***')
      await app.close()
    })
  })

  describe('POST /api/devices', () => {
    it('creates a new device', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices',
        payload: { nickname: 'Test RM', deviceIp: '10.11.99.1', authMethod: 'password', sshPassword: 'test' },
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.device).toBeTruthy()
      expect(body.device.id).toBeTruthy()
      expect(body.device.nickname).toBe('Test RM')
      const saved = JSON.parse(readFileSync(config.deviceConfigPath, 'utf8'))
      expect(saved.devices[0].deviceIp).toBe('10.11.99.1')
      expect(saved.devices[0].sshPort).toBe(22)
      await app.close()
    })
  })

  describe('GET /api/devices/:id/backups', () => {
    it('returns empty list when no backups exist', async () => {
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [{ id: 'bk-1', nickname: 'BK', deviceIp: '1.1.1.1', sshPort: 22, authMethod: 'password' }],
        activeDeviceId: 'bk-1',
      })

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/devices/bk-1/backups' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ backups: [] })
      await app.close()
    })

    it('lists available backups', async () => {
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [{ id: 'bk-2', nickname: 'BK2', deviceIp: '1.1.1.1', sshPort: 22, authMethod: 'password' }],
        activeDeviceId: 'bk-2',
      })

      const backupDir = resolve(config.rmMethodsBackupDir, 'bk-2', 'rm-methods_20260318_120000')
      mkdirSync(backupDir, { recursive: true })
      writeFileSync(resolve(backupDir, '.manifest'), JSON.stringify({ exportedAt: '1', templates: { a: {} } }))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/devices/bk-2/backups' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.backups).toHaveLength(1)
      expect(body.backups[0].name).toBe('rm-methods_20260318_120000')
      expect(body.backups[0].templateCount).toBe(1)
      await app.close()
    })
  })

  // ─── Backup / Restore routes ────────────────────────────────────────────────

  function makeBackupZip(opts: {
    customTemplates?: Array<{ filename: string; name: string; content: string; rmMethodsId?: string }>
    debugTemplates?: Array<{ filename: string; name: string; content: string }>
  }): Buffer {
    const fileMap: Record<string, Uint8Array> = {}

    const customRegEntries = (opts.customTemplates ?? []).map(t => ({
      name: t.name,
      filename: `custom/${t.filename}`,
      iconCode: '\ue9d8',
      landscape: false,
      categories: ['Custom'],
      ...(t.rmMethodsId ? { rmMethodsId: t.rmMethodsId } : {}),
    }))
    const debugRegEntries = (opts.debugTemplates ?? []).map(t => ({
      name: t.name,
      filename: `debug/${t.filename}`,
      iconCode: '\ue9d8',
      landscape: false,
      categories: ['Debug'],
    }))

    fileMap['backup-manifest.json'] = strToU8(JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      customTemplateCount: customRegEntries.length,
      debugTemplateCount: debugRegEntries.length,
    }, null, 2))

    if (customRegEntries.length > 0) {
      fileMap['custom/custom-registry.json'] = strToU8(JSON.stringify({ templates: customRegEntries }, null, 2))
      for (const t of opts.customTemplates!) {
        fileMap[`custom/${t.filename}.template`] = strToU8(t.content)
      }
    }
    if (debugRegEntries.length > 0) {
      fileMap['debug/debug-registry.json'] = strToU8(JSON.stringify({ templates: debugRegEntries }, null, 2))
      for (const t of opts.debugTemplates!) {
        fileMap[`debug/${t.filename}.template`] = strToU8(t.content)
      }
    }

    return Buffer.from(zipSync(fileMap))
  }

  const validTemplate = JSON.stringify({
    name: 'Test', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
    categories: ['Custom'], orientation: 'portrait', constants: [], items: [],
  })

  describe('GET /api/backup', () => {
    it('returns a ZIP with backup-manifest.json', async () => {
      // Seed a custom template
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Grid', filename: 'custom/P Grid', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] }],
      }))
      writeFileSync(resolve(config.customDir, 'P Grid.template'), validTemplate)

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/backup' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')
      expect(res.headers['content-disposition']).toMatch(/remarkable-backup-.*\.zip/)

      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      expect(unzipped['backup-manifest.json']).toBeDefined()
      expect(unzipped['custom/custom-registry.json']).toBeDefined()
      expect(unzipped['custom/P Grid.template']).toBeDefined()

      // Verify server-side copy was saved
      expect(existsSync(config.appBackupsDir)).toBe(true)
      await app.close()
    })

    it('returns a ZIP even with no templates', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/backup' })
      expect(res.statusCode).toBe(200)
      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      expect(unzipped['backup-manifest.json']).toBeDefined()
      await app.close()
    })
  })

  describe('POST /api/restore (merge)', () => {
    it('adds new templates from backup', async () => {
      const zip = makeBackupZip({
        customTemplates: [{ filename: 'P NewGrid', name: 'NewGrid', content: validTemplate }],
      })

      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/restore?mode=merge',
        headers: { 'content-type': 'application/zip' },
        payload: zip,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.ok).toBe(true)
      expect(body.added).toContain('NewGrid')
      expect(existsSync(resolve(config.customDir, 'P NewGrid.template'))).toBe(true)
      await app.close()
    })

    it('skips existing templates in merge mode', async () => {
      // Seed existing template
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Existing', filename: 'custom/P Existing', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] }],
      }))
      writeFileSync(resolve(config.customDir, 'P Existing.template'), validTemplate)

      const zip = makeBackupZip({
        customTemplates: [{ filename: 'P Existing', name: 'Existing', content: validTemplate }],
      })

      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/restore?mode=merge',
        headers: { 'content-type': 'application/zip' },
        payload: zip,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.skipped).toContain('Existing')
      expect(body.added).toHaveLength(0)
      await app.close()
    })
  })

  describe('POST /api/restore (replace)', () => {
    it('replaces all templates with backup contents', async () => {
      // Seed existing template that is NOT in the backup
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Old', filename: 'custom/P Old', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] }],
      }))
      writeFileSync(resolve(config.customDir, 'P Old.template'), validTemplate)

      const zip = makeBackupZip({
        customTemplates: [{ filename: 'P New', name: 'New', content: validTemplate }],
      })

      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/restore?mode=replace',
        headers: { 'content-type': 'application/zip' },
        payload: zip,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.removed).toContain('Old')
      expect(body.added).toContain('custom/P New.template')

      // Old template file should be deleted
      expect(existsSync(resolve(config.customDir, 'P Old.template'))).toBe(false)
      // New template file should exist
      expect(existsSync(resolve(config.customDir, 'P New.template'))).toBe(true)
      await app.close()
    })

    it('rejects invalid mode', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/restore?mode=invalid',
        headers: { 'content-type': 'application/zip' },
        payload: Buffer.from(zipSync({ 'backup-manifest.json': strToU8('{}') })),
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('POST /api/restore/preview', () => {
    it('returns merge preview with add/skip/wouldRemove', async () => {
      // Seed an existing template
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Existing', filename: 'custom/P Existing', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] }],
      }))

      const zip = makeBackupZip({
        customTemplates: [
          { filename: 'P Existing', name: 'Existing', content: validTemplate },
          { filename: 'P Brand New', name: 'Brand New', content: validTemplate },
        ],
      })

      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/restore/preview',
        headers: { 'content-type': 'application/zip' },
        payload: zip,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.mergeSkipped).toContain('Existing')
      expect(body.mergeAdded).toContain('Brand New')
      expect(body.incomingCount).toBe(2)
      await app.close()
    })
  })

  describe('GET /api/backups', () => {
    it('returns empty list when no backups exist', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/backups' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ backups: [] })
      await app.close()
    })

    it('lists backup files', async () => {
      mkdirSync(config.appBackupsDir, { recursive: true })
      writeFileSync(resolve(config.appBackupsDir, 'remarkable-backup-2026-03-17_100000.zip'), 'fake1')
      writeFileSync(resolve(config.appBackupsDir, 'remarkable-backup-2026-03-18_100000.zip'), 'fake2')
      // Non-zip files should be excluded
      writeFileSync(resolve(config.appBackupsDir, 'not-a-backup.txt'), 'nope')

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/backups' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.backups).toHaveLength(2)
      const filenames = body.backups.map((b: { filename: string }) => b.filename)
      expect(filenames).toContain('remarkable-backup-2026-03-17_100000.zip')
      expect(filenames).toContain('remarkable-backup-2026-03-18_100000.zip')
      await app.close()
    })
  })

  describe('DELETE /api/backups/:filename', () => {
    it('deletes a backup file', async () => {
      mkdirSync(config.appBackupsDir, { recursive: true })
      const backupFile = resolve(config.appBackupsDir, 'remarkable-backup-test.zip')
      writeFileSync(backupFile, 'fake')

      const app = await createApp(config)
      const res = await app.inject({ method: 'DELETE', url: '/api/backups/remarkable-backup-test.zip' })
      expect(res.statusCode).toBe(200)
      expect(existsSync(backupFile)).toBe(false)
      await app.close()
    })

    it('returns 404 for non-existent backup', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'DELETE', url: '/api/backups/nope.zip' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('rejects path traversal attempts', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'DELETE', url: '/api/backups/..%2F..%2Fimportant.zip' })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('POST /api/restore/cleanup', () => {
    it('removes specified templates from registry and filesystem', async () => {
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [
          { name: 'Keep', filename: 'custom/P Keep', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] },
          { name: 'Remove', filename: 'custom/P Remove', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] },
        ],
      }))
      writeFileSync(resolve(config.customDir, 'P Keep.template'), validTemplate)
      writeFileSync(resolve(config.customDir, 'P Remove.template'), validTemplate)

      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/restore/cleanup',
        payload: {
          templates: [{ filename: 'custom/P Remove', collection: 'custom' }],
        },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.removed).toContain('custom/P Remove')

      // File should be deleted
      expect(existsSync(resolve(config.customDir, 'P Remove.template'))).toBe(false)
      // Keep template untouched
      expect(existsSync(resolve(config.customDir, 'P Keep.template'))).toBe(true)

      // Registry should only have Keep
      const reg = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(reg.templates).toHaveLength(1)
      expect(reg.templates[0].name).toBe('Keep')
      await app.close()
    })
  })
})
