// @vitest-environment node
/**
 * SSH integration tests for xovi extension routes.
 *
 * Uses an in-process ssh2 mock server backed by a real temp directory.
 * All routes are exercised via Fastify app.inject() — no running server needed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp } from '../app.ts'
import { resolveConfig, resolveDevicePaths, type ServerConfig } from '../config.ts'
import { writeDeviceStore } from '../lib/deviceStore.ts'
import type { DeviceConfig } from '../lib/ssh.ts'
import { startMockSshServer, type MockSshServer } from './helpers/mockSshServer.ts'
import { seedXoviFs } from './helpers/seedDeviceFs.ts'
import { parseNdjson } from './helpers/ndjsonHelper.ts'
import { startOperation, _resetForTests as resetTracker } from '../lib/operationTracker.ts'
import { writeXoviDeployedState } from '../lib/xoviDeployState.ts'
import type { XoviDeployedState } from '../lib/xoviDeployState.ts'

const TEST_TIMEOUT = 15_000
const DEVICE_ID = 'test-xovi-dev'

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

function createDevice(config: ServerConfig, mockServer: MockSshServer, overrides?: Partial<DeviceConfig>): DeviceConfig {
  const device: DeviceConfig = {
    id: DEVICE_ID,
    nickname: 'Xovi Test RM',
    deviceIp: '127.0.0.1',
    sshPort: mockServer.port,
    authMethod: 'password',
    sshPassword: 'test',
    firmwareVersion: '3.26.0.68',
    deviceModel: 'rm',
    ...overrides,
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

  beforeAll(async () => {
    mockServer = await startMockSshServer()
  }, TEST_TIMEOUT)

  afterAll(async () => {
    await mockServer.close()
    rmSync(mockServer.fsRoot, { recursive: true, force: true })
  })

  let config: ServerConfig

  beforeEach(() => {
    config = makeConfig()
    mockServer.resetFs()
    resetTracker()
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  // ── xovi-status ─────────────────────────────────────────────────────────

  describe('xovi-status', () => {
    it('returns full status when xovi + vellum installed', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { qmdFiles: ['unlockMethodsContent.qmd'] })

      const app = await createApp(config)
      try {
        const res = await app.inject({ method: 'POST', url: `/api/devices/${DEVICE_ID}/xovi-status` })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.body)
        expect(body.ok).toBe(true)
        expect(body.xoviInstalled).toBe(true)
        expect(body.qtRebuilderInstalled).toBe(true)
        expect(body.vellumInstalled).toBe(true)
        expect(body.extensions).toBeInstanceOf(Array)
        expect(body.extensions.length).toBeGreaterThan(0)
        // The unlockMethodsContent.qmd we seeded should be detected as installed
        const unlock = body.extensions.find((e: { id: string }) => e.id === 'unlockMethodsContent')
        expect(unlock?.installed).toBe(true)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('reports xovi not installed when xovi.so missing', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { xovi: false })

      const app = await createApp(config)
      try {
        const res = await app.inject({ method: 'POST', url: `/api/devices/${DEVICE_ID}/xovi-status` })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.body)
        expect(body.ok).toBe(true)
        expect(body.xoviInstalled).toBe(false)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('reports vellum not installed', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { vellum: false })

      const app = await createApp(config)
      try {
        const res = await app.inject({ method: 'POST', url: `/api/devices/${DEVICE_ID}/xovi-status` })
        const body = JSON.parse(res.body)
        expect(body.vellumInstalled).toBe(false)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('lists unknown QMD files', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, {
        qmdFiles: ['unlockMethodsContent.qmd', 'myCustomExtension.qmd'],
      })

      const app = await createApp(config)
      try {
        const res = await app.inject({ method: 'POST', url: `/api/devices/${DEVICE_ID}/xovi-status` })
        const body = JSON.parse(res.body)
        expect(body.unknownFiles).toContain('myCustomExtension.qmd')
        expect(body.unknownFiles).not.toContain('unlockMethodsContent.qmd')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('returns tracking state when present', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot)

      const paths = resolveDevicePaths(config, DEVICE_ID)
      const state: XoviDeployedState = {
        pristineFiles: ['existing.qmd'],
        deployedExtensionIds: ['unlockMethodsContent'],
        capturedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      writeXoviDeployedState(paths.xoviDeployedState, state)

      const app = await createApp(config)
      try {
        const res = await app.inject({ method: 'POST', url: `/api/devices/${DEVICE_ID}/xovi-status` })
        const body = JSON.parse(res.body)
        expect(body.tracking).toBeTruthy()
        expect(body.tracking.deployedExtensionIds).toContain('unlockMethodsContent')
        expect(body.tracking.pristineFiles).toContain('existing.qmd')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ── xovi-deploy ─────────────────────────────────────────────────────────

  describe('xovi-deploy', () => {
    it('deploys extensions, rebuilds, restarts, and updates tracking', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot)

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-deploy`,
          payload: { extensionIds: ['unlockMethodsContent'] },
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()
        expect((done as Record<string, unknown>).ok).toBe(true)

        // Verify QMD file was pushed to device
        const qmdDir = resolve(mockServer.fsRoot, 'home/root/xovi/exthome/qt-resource-rebuilder')
        const files = readdirSync(qmdDir).filter(f => f.endsWith('.qmd'))
        expect(files).toContain('unlockMethodsContent.qmd')

        // Verify tracking file written
        const paths = resolveDevicePaths(config, DEVICE_ID)
        expect(existsSync(paths.xoviDeployedState)).toBe(true)
        const tracking = JSON.parse(readFileSync(paths.xoviDeployedState, 'utf8'))
        expect(tracking.deployedExtensionIds).toContain('unlockMethodsContent')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('captures pristine state on first deploy', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { qmdFiles: ['existingUserExtension.qmd'] })

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-deploy`,
          payload: { extensionIds: ['unlockMethodsContent'] },
        })
        const events = parseNdjson(res.body)
        expect(events.find(e => e.type === 'done')).toBeTruthy()

        // Verify pristine state captured the pre-existing QMD
        const paths = resolveDevicePaths(config, DEVICE_ID)
        const tracking = JSON.parse(readFileSync(paths.xoviDeployedState, 'utf8'))
        expect(tracking.pristineFiles).toContain('existingUserExtension.qmd')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('second deploy adds to existing tracking', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot)

      const app = await createApp(config)
      try {
        // First deploy
        await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-deploy`,
          payload: { extensionIds: ['unlockMethodsContent'] },
        })
        resetTracker() // Clear operation lock

        // Second deploy
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-deploy`,
          payload: { extensionIds: ['preventNotebookZoomOut'] },
        })
        const events = parseNdjson(res.body)
        expect(events.find(e => e.type === 'done')).toBeTruthy()

        const paths = resolveDevicePaths(config, DEVICE_ID)
        const tracking = JSON.parse(readFileSync(paths.xoviDeployedState, 'utf8'))
        expect(tracking.deployedExtensionIds).toContain('unlockMethodsContent')
        expect(tracking.deployedExtensionIds).toContain('preventNotebookZoomOut')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('returns 400 for unknown extension IDs', async () => {
      createDevice(config, mockServer)
      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-deploy`,
          payload: { extensionIds: ['nonExistentExtension'] },
        })
        expect(res.statusCode).toBe(400)
      } finally {
        await app.close()
      }
    })

    it('returns 400 for exclusive group conflict', async () => {
      createDevice(config, mockServer)
      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-deploy`,
          payload: { extensionIds: ['createPagesRM2Size', 'createPagesPaperProSize'] },
        })
        expect(res.statusCode).toBe(400)
      } finally {
        await app.close()
      }
    })

    it('returns 400 when firmware version missing', async () => {
      createDevice(config, mockServer, { firmwareVersion: undefined })
      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-deploy`,
          payload: { extensionIds: ['unlockMethodsContent'] },
        })
        expect(res.statusCode).toBe(400)
      } finally {
        await app.close()
      }
    })

    it('errors when xovi not installed on device', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { xovi: false })

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-deploy`,
          payload: { extensionIds: ['unlockMethodsContent'] },
        })
        const events = parseNdjson(res.body)
        const err = events.find(e => e.type === 'error')
        expect(err).toBeTruthy()
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('returns 409 when another operation running', async () => {
      createDevice(config, mockServer)
      startOperation(DEVICE_ID, 'deploy-methods')

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-deploy`,
          payload: { extensionIds: ['unlockMethodsContent'] },
        })
        expect(res.statusCode).toBe(409)
      } finally {
        await app.close()
      }
    })
  })

  // ── xovi-remove ─────────────────────────────────────────────────────────

  describe('xovi-remove', () => {
    it('removes QMD files, rebuilds, restarts, and updates tracking', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { qmdFiles: ['unlockMethodsContent.qmd'] })

      // Pre-populate tracking
      const paths = resolveDevicePaths(config, DEVICE_ID)
      writeXoviDeployedState(paths.xoviDeployedState, {
        pristineFiles: [],
        deployedExtensionIds: ['unlockMethodsContent'],
        capturedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-remove`,
          payload: { extensionIds: ['unlockMethodsContent'] },
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        expect(events.find(e => e.type === 'done')).toBeTruthy()

        // Verify QMD file removed from device
        const qmdDir = resolve(mockServer.fsRoot, 'home/root/xovi/exthome/qt-resource-rebuilder')
        const remaining = readdirSync(qmdDir).filter(f => f.endsWith('.qmd'))
        expect(remaining).not.toContain('unlockMethodsContent.qmd')

        // Verify tracking updated
        const tracking = JSON.parse(readFileSync(paths.xoviDeployedState, 'utf8'))
        expect(tracking.deployedExtensionIds).not.toContain('unlockMethodsContent')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('returns 400 for unknown extension IDs', async () => {
      createDevice(config, mockServer)
      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-remove`,
          payload: { extensionIds: ['fakeExtension'] },
        })
        expect(res.statusCode).toBe(400)
      } finally {
        await app.close()
      }
    })

    it('returns 409 when another operation running', async () => {
      createDevice(config, mockServer)
      startOperation(DEVICE_ID, 'deploy-methods')

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/xovi-remove`,
          payload: { extensionIds: ['unlockMethodsContent'] },
        })
        expect(res.statusCode).toBe(409)
      } finally {
        await app.close()
      }
    })
  })

  // ── vellum-install-xovi ──────────────────────────────────────────────────

  describe('vellum-install-xovi', () => {
    it('installs xovi packages via vellum', async () => {
      createDevice(config, mockServer)
      // Only vellum, no xovi yet
      seedXoviFs(mockServer.fsRoot, { xovi: false, qtRebuilder: false })

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/vellum-install-xovi`,
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        expect(events.find(e => e.type === 'done')).toBeTruthy()
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('errors when vellum not installed', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { vellum: false })

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/vellum-install-xovi`,
        })
        const events = parseNdjson(res.body)
        const err = events.find(e => e.type === 'error')
        expect(err).toBeTruthy()
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ── vellum-remove-xovi ──────────────────────────────────────────────────

  describe('vellum-remove-xovi', () => {
    it('cleans QMDs, removes packages, and clears tracking', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { qmdFiles: ['unlockMethodsContent.qmd'] })

      // Pre-populate tracking
      const paths = resolveDevicePaths(config, DEVICE_ID)
      writeXoviDeployedState(paths.xoviDeployedState, {
        pristineFiles: [],
        deployedExtensionIds: ['unlockMethodsContent'],
        capturedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/vellum-remove-xovi`,
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        expect(events.find(e => e.type === 'done')).toBeTruthy()

        // Tracking file should be cleared
        expect(existsSync(paths.xoviDeployedState)).toBe(false)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('errors when vellum not installed', async () => {
      createDevice(config, mockServer)
      seedXoviFs(mockServer.fsRoot, { vellum: false })

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/devices/${DEVICE_ID}/vellum-remove-xovi`,
        })
        const events = parseNdjson(res.body)
        const err = events.find(e => e.type === 'error')
        expect(err).toBeTruthy()
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })
})
