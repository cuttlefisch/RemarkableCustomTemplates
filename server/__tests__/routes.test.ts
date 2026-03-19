// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
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
})
