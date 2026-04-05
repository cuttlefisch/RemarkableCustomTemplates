// @vitest-environment node
/**
 * SSH integration tests for xovi extension routes.
 *
 * Uses an in-process ssh2 mock server backed by a real temp directory.
 * Tests the full xovi lifecycle: status, deploy, remove, vellum install/remove.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'
import { writeDeviceStore } from '../lib/deviceStore.ts'
import type { DeviceConfig } from '../lib/ssh.ts'
import { startMockSshServer, type MockSshServer } from './helpers/mockSshServer.ts'
import { seedXoviFs } from './helpers/seedDeviceFs.ts'
import { parseNdjson } from './helpers/ndjsonHelper.ts'

const TEST_TIMEOUT = 15_000

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `xovi-integ-${Date.now()}-${Math.random().toString(36).slice(2)}`)
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

function seedDevice(
  config: ServerConfig,
  mockServer: MockSshServer,
  opts?: { firmwareVersion?: string },
): DeviceConfig {
  const device: DeviceConfig = {
    id: 'test-dev-1',
    nickname: 'Test RM',
    deviceIp: '127.0.0.1',
    sshPort: mockServer.port,
    authMethod: 'password',
    sshPassword: 'test',
    firmwareVersion: opts?.firmwareVersion ?? '3.26.1.2',
    deviceModel: 'rmPP',
  }
  writeDeviceStore(config.deviceConfigPath, {
    version: 2,
    devices: [device],
    activeDeviceId: device.id,
  })
  return device
}

describe('xovi SSH integration', () => {
  let mockServer: MockSshServer
  let config: ServerConfig

  beforeAll(async () => {
    mockServer = await startMockSshServer()
  })

  afterAll(async () => {
    await mockServer.close()
  })

  beforeEach(() => {
    config = makeConfig()
    mockServer.resetFs()
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  // ── xovi-status ──────────────────────────────────────────────────────────

  describe('POST /api/devices/:id/xovi-status', () => {
    it('returns full status with xovi installed', async () => {
      seedDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot)
      const app = await createApp(config)
      const res = await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/xovi-status' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.ok).toBe(true)
      expect(body.xoviInstalled).toBe(true)
      expect(body.qtRebuilderInstalled).toBe(true)
      expect(body.vellumInstalled).toBe(true)
      expect(body.qmdVersion).toBe('3.26')
      expect(body.supportedVersionRange).toEqual({ min: '3.22', max: '3.26' })
      await app.close()
    }, TEST_TIMEOUT)

    it('reports unsupported firmware when version is too new', async () => {
      seedDevice(config, mockServer, { firmwareVersion: '3.99.0.0' })
      seedXoviFs(mockServer.fsRoot)
      const app = await createApp(config)
      const res = await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/xovi-status' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.qmdVersion).toBeNull()
      expect(body.supportedVersionRange).toEqual({ min: '3.22', max: '3.26' })
      await app.close()
    }, TEST_TIMEOUT)

    it('detects vellum reenable needed', async () => {
      seedDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { reenableNeeded: true })
      const app = await createApp(config)
      const res = await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/xovi-status' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.vellumReenableNeeded).toBe(true)
      await app.close()
    }, TEST_TIMEOUT)
  })

  // ── xovi-deploy ──────────────────────────────────────────────────────────

  describe('POST /api/devices/:id/xovi-deploy', () => {
    it('deploys extensions successfully', async () => {
      seedDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot)
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/xovi-deploy',
        payload: { extensionIds: ['unlockMethodsContent'] },
      })
      expect(res.statusCode).toBe(200)
      const events = parseNdjson(res.body)
      const done = events.find(e => e.type === 'done')
      expect(done).toBeTruthy()
      expect((done as Record<string, unknown>).extensions).toEqual(['unlockMethodsContent'])
      await app.close()
    }, TEST_TIMEOUT)

    it('blocks deploy when vellum reenable is needed', async () => {
      seedDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { reenableNeeded: true })
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/xovi-deploy',
        payload: { extensionIds: ['unlockMethodsContent'] },
      })
      expect(res.statusCode).toBe(200)
      const events = parseNdjson(res.body)
      const error = events.find(e => e.type === 'error')
      expect(error).toBeTruthy()
      expect((error as Record<string, unknown>).error).toMatch(/firmware was updated/)
      expect((error as Record<string, unknown>).hint).toMatch(/vellum reenable/)
      await app.close()
    }, TEST_TIMEOUT)

    it('blocks deploy when xovi is not installed', async () => {
      seedDevice(config, mockServer)
      // No seedXoviFs — xovi not installed
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/xovi-deploy',
        payload: { extensionIds: ['unlockMethodsContent'] },
      })
      expect(res.statusCode).toBe(200)
      const events = parseNdjson(res.body)
      const error = events.find(e => e.type === 'error')
      expect(error).toBeTruthy()
      expect((error as Record<string, unknown>).error).toMatch(/not installed/)
      await app.close()
    }, TEST_TIMEOUT)

    it('returns 400 for unsupported firmware version with version range in hint', async () => {
      seedDevice(config, mockServer, { firmwareVersion: '3.99.0.0' })
      seedXoviFs(mockServer.fsRoot)
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/xovi-deploy',
        payload: { extensionIds: ['unlockMethodsContent'] },
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.error).toMatch(/No extensions available/)
      expect(body.hint).toMatch(/3\.22/)
      expect(body.hint).toMatch(/3\.26/)
      expect(body.hint).toMatch(/firmware-specific/)
      await app.close()
    }, TEST_TIMEOUT)
  })

  // ── xovi-remove ──────────────────────────────────────────────────────────

  describe('POST /api/devices/:id/xovi-remove', () => {
    it('removes extensions successfully', async () => {
      seedDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot)
      // Put a fake QMD file on "device"
      const qmdDir = resolve(mockServer.fsRoot, 'home/root/xovi/exthome/qt-resource-rebuilder')
      writeFileSync(resolve(qmdDir, 'unlockMethodsContent.qmd'), 'fake-qmd')
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/xovi-remove',
        payload: { extensionIds: ['unlockMethodsContent'] },
      })
      expect(res.statusCode).toBe(200)
      const events = parseNdjson(res.body)
      const done = events.find(e => e.type === 'done')
      expect(done).toBeTruthy()
      expect((done as Record<string, unknown>).removed).toEqual(['unlockMethodsContent'])
      await app.close()
    }, TEST_TIMEOUT)
  })

  // ── vellum-install-xovi ──────────────────────────────────────────────────

  describe('POST /api/devices/:id/vellum-install-xovi', () => {
    it('installs xovi when vellum is ready', async () => {
      seedDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { xovi: false, qtRebuilder: false, vellum: true })
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/vellum-install-xovi',
      })
      expect(res.statusCode).toBe(200)
      const events = parseNdjson(res.body)
      const done = events.find(e => e.type === 'done')
      expect(done).toBeTruthy()
      expect((done as Record<string, string>).message).toMatch(/installed successfully/)
      await app.close()
    }, TEST_TIMEOUT)

    it('blocks install when vellum reenable is needed', async () => {
      seedDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { vellum: true, reenableNeeded: true })
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/vellum-install-xovi',
      })
      expect(res.statusCode).toBe(200)
      const events = parseNdjson(res.body)
      const error = events.find(e => e.type === 'error')
      expect(error).toBeTruthy()
      expect((error as Record<string, unknown>).error).toMatch(/re-enabled/)
      await app.close()
    }, TEST_TIMEOUT)

    it('errors when vellum is not installed', async () => {
      seedDevice(config, mockServer)
      // No vellum
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/vellum-install-xovi',
      })
      expect(res.statusCode).toBe(200)
      const events = parseNdjson(res.body)
      const error = events.find(e => e.type === 'error')
      expect(error).toBeTruthy()
      expect((error as Record<string, unknown>).error).toMatch(/not installed/)
      await app.close()
    }, TEST_TIMEOUT)
  })

  // ── vellum-remove-xovi ───────────────────────────────────────────────────

  describe('POST /api/devices/:id/vellum-remove-xovi', () => {
    it('cleans QMD files before uninstalling xovi', async () => {
      seedDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot)
      // Put QMD files on "device"
      const qmdDir = resolve(mockServer.fsRoot, 'home/root/xovi/exthome/qt-resource-rebuilder')
      writeFileSync(resolve(qmdDir, 'unlockMethodsContent.qmd'), 'fake-qmd')
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/vellum-remove-xovi',
      })
      expect(res.statusCode).toBe(200)
      const events = parseNdjson(res.body)
      const done = events.find(e => e.type === 'done')
      expect(done).toBeTruthy()
      expect((done as Record<string, string>).message).toMatch(/removed successfully/)
      // Verify steps include expected operations
      const steps = (done as Record<string, unknown>).steps as string[]
      expect(steps).toBeDefined()
      expect(steps.some(s => s.includes('Removed xovi') || s.includes('Cleaned QMD'))).toBe(true)
      await app.close()
    }, TEST_TIMEOUT)

    it('errors when vellum is not installed', async () => {
      seedDevice(config, mockServer)
      // No vellum
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/test-dev-1/vellum-remove-xovi',
      })
      expect(res.statusCode).toBe(200)
      const events = parseNdjson(res.body)
      const error = events.find(e => e.type === 'error')
      expect(error).toBeTruthy()
      expect((error as Record<string, unknown>).error).toMatch(/not installed/)
      await app.close()
    }, TEST_TIMEOUT)
  })
})
