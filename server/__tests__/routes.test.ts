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

  describe('GET /templates/templates.json (production mode)', () => {
    it('returns merged registry even when dist/ has a static templates.json', async () => {
      // In production, @fastify/static serves files from dist/. Without globIgnore,
      // it would intercept /templates/templates.json and serve the stale static file
      // instead of letting the Fastify route handler merge registries.
      const prodConfig = resolveConfig({ dataDir: config.dataDir, port: 0, production: true })

      writeFileSync(prodConfig.methodsRegistry, JSON.stringify({
        templates: [{
          name: 'SEYES',
          filename: 'methods/SEYES',
          iconCode: '\ue9d8',
          landscape: false,
          categories: ['Lines'],
          origin: 'official-methods',
          rmMethodsId: 'fake-uuid-1234',
        }],
      }))
      writeFileSync(resolve(prodConfig.officialDir, 'templates.json'), JSON.stringify({
        templates: [{ name: 'Official', filename: 'P Official', iconCode: '\ue9d8', landscape: false, categories: ['Lines'] }],
      }))

      const app = await createApp(prodConfig)
      const res = await app.inject({ method: 'GET', url: '/templates/templates.json' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      const names = body.templates.map((t: { name: string }) => t.name)
      expect(names).toContain('SEYES')
      expect(names).toContain('Official')
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
    it('deletes a custom template and cleans up methods-registry', async () => {
      const uuid = 'test-uuid-1234'
      // Seed custom registry with rmMethodsId
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Test', filename: 'custom/P Test', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], rmMethodsId: uuid }],
      }))
      // Seed methods registry with matching entry
      writeFileSync(config.methodsRegistry, JSON.stringify({
        templates: [{ name: 'Test', filename: `methods/${uuid}`, iconCode: '\ue9d8', landscape: false, categories: ['Custom'], origin: 'custom-methods', rmMethodsId: uuid }],
      }))
      // Create both template files
      writeFileSync(resolve(config.customDir, 'P Test.template'), '{"name":"Test"}')
      writeFileSync(resolve(config.methodsDir, `${uuid}.template`), '{"name":"Test"}')

      const app = await createApp(config)
      const res = await app.inject({ method: 'DELETE', url: '/api/custom-templates/P Test' })
      expect(res.statusCode).toBe(200)

      // Custom registry cleaned
      const customReg = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(customReg.templates).toHaveLength(0)
      // Methods registry cleaned
      const methodsReg = JSON.parse(readFileSync(config.methodsRegistry, 'utf8'))
      expect(methodsReg.templates).toHaveLength(0)
      // Both template files removed
      expect(existsSync(resolve(config.customDir, 'P Test.template'))).toBe(false)
      expect(existsSync(resolve(config.methodsDir, `${uuid}.template`))).toBe(false)
      await app.close()
    })

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

    it('handles copy-chain: create, copy repeatedly, then delete all', async () => {
      // Simulates the exact frontend "copy a copy of a copy" flow
      const sampleContent = JSON.stringify({
        name: 'Sample Grid', author: 'Test', orientation: 'portrait',
        categories: ['Samples'], constants: [], items: [],
      })
      // Seed a sample template to copy from
      mkdirSync(resolve(config.dataDir, 'public/templates/samples'), { recursive: true })
      writeFileSync(resolve(config.dataDir, 'public/templates/samples', 'P Sample Grid.template'), sampleContent)

      const app = await createApp(config)

      // Copy 1: create from sample
      const copy1 = await app.inject({
        method: 'POST', url: '/api/custom-templates',
        payload: {
          filename: 'P Sample Grid-copy',
          content: JSON.stringify({ ...JSON.parse(sampleContent), name: 'Sample Grid (Copy)' }, null, 2),
          entry: { name: 'Sample Grid (Copy)', filename: 'custom/P Sample Grid-copy', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], isCustom: true },
        },
      })
      expect(copy1.statusCode).toBe(201)

      // Verify the copy is fetchable (this is what handleCopy does before creating copy 2)
      const fetch1 = await app.inject({ method: 'GET', url: '/templates/custom/P%20Sample%20Grid-copy.template' })
      expect(fetch1.statusCode).toBe(200)

      // Copy 2: copy of copy
      const copy2 = await app.inject({
        method: 'POST', url: '/api/custom-templates',
        payload: {
          filename: 'P Sample Grid-copy-copy',
          content: JSON.stringify({ ...JSON.parse(sampleContent), name: 'Sample Grid (Copy) (Copy)' }, null, 2),
          entry: { name: 'Sample Grid (Copy) (Copy)', filename: 'custom/P Sample Grid-copy-copy', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], isCustom: true },
        },
      })
      expect(copy2.statusCode).toBe(201)

      // Copy 3: copy of copy of copy
      const copy3 = await app.inject({
        method: 'POST', url: '/api/custom-templates',
        payload: {
          filename: 'P Sample Grid-copy-copy-copy',
          content: JSON.stringify({ ...JSON.parse(sampleContent), name: 'Sample Grid (Copy) (Copy) (Copy)' }, null, 2),
          entry: { name: 'Sample Grid (Copy) (Copy) (Copy)', filename: 'custom/P Sample Grid-copy-copy-copy', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], isCustom: true },
        },
      })
      expect(copy3.statusCode).toBe(201)

      // Copy 4: copy of copy of copy of copy
      const copy4 = await app.inject({
        method: 'POST', url: '/api/custom-templates',
        payload: {
          filename: 'P Sample Grid-copy-copy-copy-copy',
          content: JSON.stringify({ ...JSON.parse(sampleContent), name: 'Sample Grid (Copy) (Copy) (Copy) (Copy)' }, null, 2),
          entry: { name: 'Sample Grid (Copy) (Copy) (Copy) (Copy)', filename: 'custom/P Sample Grid-copy-copy-copy-copy', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], isCustom: true },
        },
      })
      expect(copy4.statusCode).toBe(201)

      // Verify registry has all 4
      const regBefore = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(regBefore.templates).toHaveLength(4)
      expect(regBefore.templates.every((t: { isCustom?: boolean }) => t.isCustom === true)).toBe(true)

      // Verify all template files are fetchable
      for (const suffix of ['-copy', '-copy-copy', '-copy-copy-copy', '-copy-copy-copy-copy']) {
        const r = await app.inject({ method: 'GET', url: `/templates/custom/P%20Sample%20Grid${suffix}.template` })
        expect(r.statusCode).toBe(200)
      }

      // Delete all in reverse order
      for (const suffix of ['-copy-copy-copy-copy', '-copy-copy-copy', '-copy-copy', '-copy']) {
        const slug = `P Sample Grid${suffix}`
        const r = await app.inject({ method: 'DELETE', url: `/api/custom-templates/${encodeURIComponent(slug)}` })
        expect(r.statusCode).toBe(200)
      }

      // Verify registry is empty
      const regAfter = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(regAfter.templates).toHaveLength(0)

      // Verify all template files are gone
      for (const suffix of ['-copy', '-copy-copy', '-copy-copy-copy', '-copy-copy-copy-copy']) {
        expect(existsSync(resolve(config.customDir, `P Sample Grid${suffix}.template`))).toBe(false)
      }

      await app.close()
    })

    it('deduplicates registry when creating with same filename twice', async () => {
      const content = '{"name":"T","orientation":"portrait","categories":["Custom"],"constants":[],"items":[]}'
      const app = await createApp(config)

      // Create same template twice (simulates mashing Copy button)
      for (let i = 0; i < 3; i++) {
        const r = await app.inject({
          method: 'POST', url: '/api/custom-templates',
          payload: {
            filename: 'P Dupe Test',
            content,
            entry: { name: 'Dupe Test', filename: 'custom/P Dupe Test', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], isCustom: true },
          },
        })
        expect(r.statusCode).toBe(201)
      }

      // Should have exactly 1 entry, not 3
      const reg = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(reg.templates).toHaveLength(1)
      expect(reg.templates[0].filename).toBe('custom/P Dupe Test')

      // Delete should clean up fully
      const del = await app.inject({ method: 'DELETE', url: '/api/custom-templates/P Dupe Test' })
      expect(del.statusCode).toBe(200)
      const regAfter = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(regAfter.templates).toHaveLength(0)

      await app.close()
    })

    it('bulk delete: deletes multiple custom templates in sequence', async () => {
      const content = '{"name":"T","orientation":"portrait","categories":["Custom"],"constants":[],"items":[]}'
      const app = await createApp(config)

      // Create 5 custom templates
      for (let i = 1; i <= 5; i++) {
        const r = await app.inject({
          method: 'POST', url: '/api/custom-templates',
          payload: {
            filename: `P Bulk Test ${i}`,
            content,
            entry: { name: `Bulk Test ${i}`, filename: `custom/P Bulk Test ${i}`, iconCode: '\ue9d8', landscape: false, categories: ['Custom'], isCustom: true },
          },
        })
        expect(r.statusCode).toBe(201)
      }

      const regBefore = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(regBefore.templates).toHaveLength(5)

      // Delete 3 of them (simulating bulk delete)
      for (const i of [2, 4, 5]) {
        const r = await app.inject({ method: 'DELETE', url: `/api/custom-templates/${encodeURIComponent(`P Bulk Test ${i}`)}` })
        expect(r.statusCode).toBe(200)
      }

      // Verify only 2 remain
      const regAfter = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(regAfter.templates).toHaveLength(2)
      expect(regAfter.templates.map((t: { name: string }) => t.name)).toEqual(['Bulk Test 1', 'Bulk Test 3'])

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

  // ─── Export routes ───────────────────────────────────────────────────────

  describe('GET /api/export-templates', () => {
    it('returns 404 when no official templates loaded', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/export-templates' })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.error).toMatch(/Official templates not loaded/)
      await app.close()
    })

    it('returns a ZIP with merged registry + template files', async () => {
      // Seed official templates
      writeFileSync(resolve(config.officialDir, 'templates.json'), JSON.stringify({
        templates: [{ name: 'Official Grid', filename: 'P Official Grid', iconCode: '\ue9d8', landscape: false, categories: ['Lines'] }],
      }))
      writeFileSync(resolve(config.officialDir, 'P Official Grid.template'), JSON.stringify({
        name: 'Official Grid', orientation: 'portrait', constants: [], items: [],
      }))

      // Seed custom template
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'My Custom', filename: 'custom/P MyCustom', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] }],
      }))
      writeFileSync(resolve(config.customDir, 'P MyCustom.template'), JSON.stringify({
        name: 'My Custom', orientation: 'portrait', constants: [], items: [],
      }))

      // Seed debug template
      writeFileSync(config.debugRegistry, JSON.stringify({
        templates: [{ name: 'Debug Lines', filename: 'debug/P DebugLines', iconCode: '\ue9d8', landscape: false, categories: ['Debug'] }],
      }))
      writeFileSync(resolve(config.debugDir, 'P DebugLines.template'), JSON.stringify({
        name: 'Debug Lines', orientation: 'portrait', constants: [], items: [],
      }))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/export-templates' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')
      expect(res.headers['content-disposition']).toBe('attachment; filename="remarkable-templates.zip"')

      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      // Should contain merged registry
      expect(unzipped['templates.json']).toBeDefined()
      const registry = JSON.parse(Buffer.from(unzipped['templates.json']).toString('utf8'))
      const names = registry.templates.map((t: { name: string }) => t.name)
      expect(names).toContain('Official Grid')
      expect(names).toContain('My Custom')
      expect(names).toContain('Debug Lines')

      // Should contain .template files
      expect(unzipped['P Official Grid.template']).toBeDefined()
      expect(unzipped['P MyCustom.template']).toBeDefined()
      expect(unzipped['P DebugLines.template']).toBeDefined()

      await app.close()
    })

    it('sets x-skipped-files header when custom templates overlap official ones', async () => {
      // Official has a template with filename "P Grid"
      writeFileSync(resolve(config.officialDir, 'templates.json'), JSON.stringify({
        templates: [{ name: 'Grid', filename: 'P Grid', iconCode: '\ue9d8', landscape: false, categories: ['Lines'] }],
      }))
      writeFileSync(resolve(config.officialDir, 'P Grid.template'), '{"name":"Grid","orientation":"portrait","constants":[],"items":[]}')

      // Custom also has "P Grid" (same filename after stripping custom/ prefix)
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Grid Custom', filename: 'custom/P Grid', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] }],
      }))
      writeFileSync(resolve(config.customDir, 'P Grid.template'), '{"name":"Grid Custom","orientation":"portrait","constants":[],"items":[]}')

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/export-templates' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['x-skipped-files']).toBe('P Grid')

      // The merged registry should NOT contain the custom "Grid Custom"
      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      const registry = JSON.parse(Buffer.from(unzipped['templates.json']).toString('utf8'))
      const names = registry.templates.map((t: { name: string }) => t.name)
      expect(names).toContain('Grid')
      expect(names).not.toContain('Grid Custom')

      await app.close()
    })

    it('resolves custom template string constants before export', async () => {
      writeFileSync(resolve(config.officialDir, 'templates.json'), JSON.stringify({
        templates: [{ name: 'Official', filename: 'P Official', iconCode: '\ue9d8', landscape: false, categories: ['Lines'] }],
      }))
      writeFileSync(resolve(config.officialDir, 'P Official.template'), '{"name":"Official","orientation":"portrait","constants":[],"items":[]}')

      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Expr Template', filename: 'custom/P ExprTpl', iconCode: '\ue9d8', landscape: false, categories: ['Custom'] }],
      }))
      // Template with a color constant (non-scalar string starting with #) and a
      // path item that references it. resolveStringConstants inlines color constants
      // into items and removes them from the constants array.
      writeFileSync(resolve(config.customDir, 'P ExprTpl.template'), JSON.stringify({
        name: 'Expr Template',
        orientation: 'portrait',
        constants: [{ lineColor: '#ff0000' }, { spacing: 10 }],
        items: [{ type: 'path', strokeColor: 'lineColor', strokeWidth: 1, data: ['M', 0, 0, 'L', 100, 100] }],
      }))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/export-templates' })
      expect(res.statusCode).toBe(200)

      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      const tplContent = JSON.parse(Buffer.from(unzipped['P ExprTpl.template']).toString('utf8'))
      // The color constant "lineColor" should be removed from constants (inlined into items)
      const colorConst = tplContent.constants.find((c: Record<string, unknown>) => 'lineColor' in c)
      expect(colorConst).toBeUndefined()
      // The numeric constant "spacing" should still be present
      const spacingConst = tplContent.constants.find((c: Record<string, unknown>) => 'spacing' in c)
      expect(spacingConst).toBeDefined()
      // The path item should have the color inlined
      expect(tplContent.items[0].strokeColor).toBe('#ff0000')

      await app.close()
    })
  })

  describe('GET /api/export-rm-methods', () => {
    it('returns a ZIP with UUID-named files and a .manifest', async () => {
      const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Methods Test', filename: 'custom/P MethodsTest', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], rmMethodsId: uuid }],
      }))
      writeFileSync(resolve(config.customDir, 'P MethodsTest.template'), JSON.stringify({
        name: 'Methods Test', author: 'test', orientation: 'portrait',
        constants: [], items: [],
      }))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/export-rm-methods' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')
      expect(res.headers['content-disposition']).toBe('attachment; filename="remarkable-rm-methods.zip"')

      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      // Should have UUID-named triplet files
      expect(unzipped[`${uuid}.template`]).toBeDefined()
      expect(unzipped[`${uuid}.metadata`]).toBeDefined()
      expect(unzipped[`${uuid}.content`]).toBeDefined()
      // Should have a .manifest
      expect(unzipped['.manifest']).toBeDefined()
      const manifest = JSON.parse(Buffer.from(unzipped['.manifest']).toString('utf8'))
      expect(manifest.templates[uuid]).toBeDefined()
      expect(manifest.templates[uuid].name).toBe('Methods Test')

      await app.close()
    })

    it('works with only debug templates (no official needed)', async () => {
      writeFileSync(config.debugRegistry, JSON.stringify({
        templates: [{ name: 'Debug Only', filename: 'debug/P DebugOnly', iconCode: '\ue9d8', landscape: false, categories: ['Debug'] }],
      }))
      writeFileSync(resolve(config.debugDir, 'P DebugOnly.template'), JSON.stringify({
        name: 'Debug Only', author: 'test', orientation: 'portrait',
        constants: [], items: [],
      }))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/export-rm-methods' })
      expect(res.statusCode).toBe(200)

      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      expect(unzipped['.manifest']).toBeDefined()
      const manifest = JSON.parse(Buffer.from(unzipped['.manifest']).toString('utf8'))
      const uuids = Object.keys(manifest.templates)
      expect(uuids).toHaveLength(1)
      expect(manifest.templates[uuids[0]].name).toBe('Debug Only')

      await app.close()
    })
  })

  describe('GET /api/export-template/:uuid', () => {
    it('returns 404 for unknown UUID', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/export-template/nonexistent-uuid' })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.error).toMatch(/not found/)
      await app.close()
    })

    it('returns a ZIP with just that template files', async () => {
      const uuid = '11111111-2222-3333-4444-555555555555'
      const otherUuid = '66666666-7777-8888-9999-aaaaaaaaaaaa'
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [
          { name: 'Target', filename: 'custom/P Target', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], rmMethodsId: uuid },
          { name: 'Other', filename: 'custom/P Other', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], rmMethodsId: otherUuid },
        ],
      }))
      writeFileSync(resolve(config.customDir, 'P Target.template'), JSON.stringify({
        name: 'Target', author: 'test', orientation: 'portrait', constants: [], items: [],
      }))
      writeFileSync(resolve(config.customDir, 'P Other.template'), JSON.stringify({
        name: 'Other', author: 'test', orientation: 'portrait', constants: [], items: [],
      }))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: `/api/export-template/${uuid}` })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')
      expect(res.headers['content-disposition']).toMatch(/Target/)

      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      const fileNames = Object.keys(unzipped)
      // Should contain only the target template's files
      expect(fileNames).toContain(`${uuid}.template`)
      expect(fileNames).toContain(`${uuid}.metadata`)
      expect(fileNames).toContain(`${uuid}.content`)
      // Should NOT contain the other template's files
      expect(fileNames).not.toContain(`${otherUuid}.template`)
      expect(fileNames).not.toContain(`${otherUuid}.metadata`)

      await app.close()
    })
  })

  describe('GET /api/export-template-by-name/:slug', () => {
    it('returns 404 for unknown slug', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: `/api/export-template-by-name/${encodeURIComponent('P Nonexistent')}` })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.error).toMatch(/not found/)
      await app.close()
    })

    it('returns a ZIP matching the slug UUID', async () => {
      const uuid = 'deadbeef-1234-5678-9abc-def012345678'
      writeFileSync(config.customRegistry, JSON.stringify({
        templates: [{ name: 'Slug Template', filename: 'custom/P SlugTpl', iconCode: '\ue9d8', landscape: false, categories: ['Custom'], rmMethodsId: uuid }],
      }))
      writeFileSync(resolve(config.customDir, 'P SlugTpl.template'), JSON.stringify({
        name: 'Slug Template', author: 'test', orientation: 'portrait', constants: [], items: [],
      }))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: `/api/export-template-by-name/${encodeURIComponent('P SlugTpl')}` })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')
      expect(res.headers['content-disposition']).toMatch(/Slug_Template/)

      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      expect(unzipped[`${uuid}.template`]).toBeDefined()
      expect(unzipped[`${uuid}.metadata`]).toBeDefined()
      expect(unzipped[`${uuid}.content`]).toBeDefined()

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

  describe('POST /api/restore-from-backup/:filename', () => {
    it('rejects invalid filename (no .zip, contains /, contains ..)', async () => {
      const app = await createApp(config)

      const noZip = await app.inject({ method: 'POST', url: '/api/restore-from-backup/backup.tar' })
      expect(noZip.statusCode).toBe(400)

      const withSlash = await app.inject({ method: 'POST', url: '/api/restore-from-backup/path%2Fbackup.zip' })
      expect(withSlash.statusCode).toBe(400)

      const withDots = await app.inject({ method: 'POST', url: '/api/restore-from-backup/..%2F..%2Fevil.zip' })
      expect(withDots.statusCode).toBe(400)

      await app.close()
    })

    it('returns 404 for non-existent backup', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'POST', url: '/api/restore-from-backup/does-not-exist.zip' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('restores templates from a server-side backup ZIP', async () => {
      // Create a valid backup ZIP in appBackupsDir
      mkdirSync(config.appBackupsDir, { recursive: true })
      const backupZip = makeBackupZip({
        customTemplates: [{ filename: 'P Restored', name: 'Restored', content: validTemplate }],
      })
      writeFileSync(resolve(config.appBackupsDir, 'remarkable-backup-restore-test.zip'), backupZip)

      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/restore-from-backup/remarkable-backup-restore-test.zip?mode=merge',
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.ok).toBe(true)
      expect(body.added).toContain('Restored')

      // Verify template was actually written to disk
      expect(existsSync(resolve(config.customDir, 'P Restored.template'))).toBe(true)
      const reg = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
      expect(reg.templates.some((t: { name: string }) => t.name === 'Restored')).toBe(true)

      await app.close()
    })
  })

  describe('GET /api/backups/:filename/download', () => {
    it('rejects invalid filename', async () => {
      const app = await createApp(config)

      const noZip = await app.inject({ method: 'GET', url: '/api/backups/backup.tar/download' })
      expect(noZip.statusCode).toBe(400)

      const withDots = await app.inject({ method: 'GET', url: '/api/backups/..%2F..%2Fevil.zip/download' })
      expect(withDots.statusCode).toBe(400)

      await app.close()
    })

    it('returns 404 for non-existent backup', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/backups/does-not-exist.zip/download' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('returns the ZIP file contents with correct headers', async () => {
      mkdirSync(config.appBackupsDir, { recursive: true })
      const backupZip = makeBackupZip({
        customTemplates: [{ filename: 'P DL Test', name: 'DL Test', content: validTemplate }],
      })
      const backupFilename = 'remarkable-backup-download-test.zip'
      writeFileSync(resolve(config.appBackupsDir, backupFilename), backupZip)

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: `/api/backups/${backupFilename}/download` })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')
      expect(res.headers['content-disposition']).toBe(`attachment; filename="${backupFilename}"`)
      expect(res.headers['content-length']).toBe(String(backupZip.length))

      // Verify the returned data is a valid ZIP with expected contents
      const unzipped = unzipSync(new Uint8Array(res.rawPayload))
      expect(unzipped['backup-manifest.json']).toBeDefined()
      expect(unzipped['custom/custom-registry.json']).toBeDefined()
      expect(unzipped['custom/P DL Test.template']).toBeDefined()

      await app.close()
    })
  })
})
