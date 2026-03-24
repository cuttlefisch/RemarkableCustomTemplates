// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'
import { writeDeviceStore } from '../lib/deviceStore.ts'

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `xoviroutes-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(base, 'public/templates/custom'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/debug'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/methods'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/samples'), { recursive: true })
  mkdirSync(resolve(base, 'remarkable_official_templates'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-dist'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-backups'), { recursive: true })
  mkdirSync(resolve(base, 'data/ssh'), { recursive: true })
  return resolveConfig({ dataDir: base, port: 0, production: false })
}

function seedDevice(config: ServerConfig, overrides?: Partial<{ firmwareVersion: string }>) {
  writeDeviceStore(config.deviceConfigPath, {
    version: 2,
    devices: [{
      id: 'dev-1',
      nickname: 'Test RM',
      deviceIp: '10.11.99.1',
      sshPort: 22,
      authMethod: 'password',
      sshPassword: 'test',
      firmwareVersion: overrides?.firmwareVersion ?? '3.26.1.2',
      deviceModel: 'rmPP',
    }],
    activeDeviceId: 'dev-1',
  })
}

describe('xovi routes', () => {
  let config: ServerConfig

  beforeEach(() => {
    config = makeConfig()
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  // ── xovi-status ──────────────────────────────────────────────────────────

  describe('POST /api/devices/:id/xovi-status', () => {
    it('returns 400 when device is not configured', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'POST', url: '/api/devices/nonexistent/xovi-status' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/not configured/)
      await app.close()
    })
  })

  // ── xovi-deploy ──────────────────────────────────────────────────────────

  describe('POST /api/devices/:id/xovi-deploy', () => {
    it('returns 400 when no extensions selected', async () => {
      seedDevice(config)
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/dev-1/xovi-deploy',
        payload: { extensionIds: [] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/No extensions selected/)
      await app.close()
    })

    it('returns 400 for unknown extension IDs', async () => {
      seedDevice(config)
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/dev-1/xovi-deploy',
        payload: { extensionIds: ['totallyFakeExtension'] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/Unknown extensions/)
      await app.close()
    })

    it('returns 400 for conflicting exclusive groups', async () => {
      seedDevice(config)
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/dev-1/xovi-deploy',
        payload: { extensionIds: ['createPagesRM2Size', 'createPagesPaperProSize'] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/mutually exclusive/)
      await app.close()
    })

    it('returns 400 when firmware version is unknown', async () => {
      seedDevice(config, { firmwareVersion: undefined as unknown as string })
      // Manually clear firmwareVersion
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [{
          id: 'dev-1',
          nickname: 'Test RM',
          deviceIp: '10.11.99.1',
          sshPort: 22,
          authMethod: 'password',
          sshPassword: 'test',
        }],
        activeDeviceId: 'dev-1',
      })
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/dev-1/xovi-deploy',
        payload: { extensionIds: ['unlockMethodsContent'] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/firmware version unknown/)
      await app.close()
    })

    it('returns 400 for unsupported firmware version', async () => {
      seedDevice(config, { firmwareVersion: '9.99.0.0' })
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/dev-1/xovi-deploy',
        payload: { extensionIds: ['unlockMethodsContent'] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/No extensions available/)
      await app.close()
    })

    it('returns 400 when extension not available for firmware version', async () => {
      seedDevice(config, { firmwareVersion: '3.22.0.0' })
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/dev-1/xovi-deploy',
        payload: { extensionIds: ['quicksheetUseTemplate'] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/not available for firmware/)
      await app.close()
    })

    it('returns 400 when device not configured', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/nonexistent/xovi-deploy',
        payload: { extensionIds: ['unlockMethodsContent'] },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  // ── xovi-remove ──────────────────────────────────────────────────────────

  describe('POST /api/devices/:id/xovi-remove', () => {
    it('returns 400 when no extensions selected', async () => {
      seedDevice(config)
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/dev-1/xovi-remove',
        payload: { extensionIds: [] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/No extensions selected/)
      await app.close()
    })

    it('returns 400 for unknown extension IDs', async () => {
      seedDevice(config)
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/dev-1/xovi-remove',
        payload: { extensionIds: ['fakeExtension'] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/Unknown extensions/)
      await app.close()
    })

    it('returns 400 when device not configured', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/nonexistent/xovi-remove',
        payload: { extensionIds: ['unlockMethodsContent'] },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  // ── vellum-install-xovi ──────────────────────────────────────────────────

  describe('POST /api/devices/:id/vellum-install-xovi', () => {
    it('returns 400 when device not configured', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/nonexistent/vellum-install-xovi',
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/not configured/)
      await app.close()
    })
  })

  // ── vellum-remove-xovi ───────────────────────────────────────────────────

  describe('POST /api/devices/:id/vellum-remove-xovi', () => {
    it('returns 400 when device not configured', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/nonexistent/vellum-remove-xovi',
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/not configured/)
      await app.close()
    })
  })
})
