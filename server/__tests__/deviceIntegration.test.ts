// @vitest-environment node
/**
 * SSH integration tests for device routes.
 *
 * Uses an in-process ssh2 mock server backed by a real temp directory.
 * All routes are exercised via Fastify app.inject() — no running server needed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'
import { writeDeviceStore } from '../lib/deviceStore.ts'
import type { DeviceConfig } from '../lib/ssh.ts'
import { startMockSshServer, type MockSshServer } from './helpers/mockSshServer.ts'
import { seedMethodsTemplates, seedClassicTemplates } from './helpers/seedDeviceFs.ts'
import { parseNdjson } from './helpers/ndjsonHelper.ts'

// Longer timeout — SSH handshake adds overhead
const TEST_TIMEOUT = 15_000

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `ssh-integ-${Date.now()}-${Math.random().toString(36).slice(2)}`)
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

function createDevice(config: ServerConfig, mockServer: MockSshServer): DeviceConfig {
  const device: DeviceConfig = {
    id: 'test-dev-1',
    nickname: 'Test RM',
    deviceIp: '127.0.0.1',
    sshPort: mockServer.port,
    authMethod: 'password',
    sshPassword: 'test',
  }
  writeDeviceStore(config.deviceConfigPath, {
    version: 2,
    devices: [device],
    activeDeviceId: device.id,
  })
  return device
}

/** Minimal valid template for building rm-methods-dist. */
const validTemplate = JSON.stringify({
  name: 'Test', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
  categories: ['Custom'], orientation: 'portrait', constants: [], items: [],
})

/** Seed a custom template so buildRmMethodsDist has something to build. */
function seedCustomTemplate(config: ServerConfig, name: string, uuid?: string) {
  const registryPath = config.customRegistry
  let reg: { templates: Array<Record<string, unknown>> } = { templates: [] }
  try { reg = JSON.parse(readFileSync(registryPath, 'utf8')) } catch { /* empty */ }

  const entry: Record<string, unknown> = {
    name,
    filename: `custom/P ${name}`,
    iconCode: '\ue9d8',
    landscape: false,
    categories: ['Custom'],
  }
  if (uuid) entry.rmMethodsId = uuid
  reg.templates.push(entry)

  writeFileSync(registryPath, JSON.stringify(reg, null, 2))
  writeFileSync(resolve(config.customDir, `P ${name}.template`), validTemplate)
}

describe('device SSH integration', () => {
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
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  // ─── test-connection ────────────────────────────────────────────────────

  describe('test-connection', () => {
    it('returns device model and firmware version', async () => {
      createDevice(config, mockServer)
      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/test-connection',
        })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.body)
        expect(body.ok).toBe(true)
        expect(body.deviceModel).toContain('reMarkable')
        expect(body.firmwareVersion).toMatch(/\d+\.\d+/)
        expect(body.lastConnected).toBeTruthy()
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('updates device store with lastConnected', async () => {
      createDevice(config, mockServer)
      const app = await createApp(config)
      try {
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/test-connection' })
        const store = JSON.parse(readFileSync(config.deviceConfigPath, 'utf8'))
        const saved = store.devices.find((d: DeviceConfig) => d.id === 'test-dev-1')
        expect(saved.lastConnected).toBeTruthy()
        expect(saved.deviceModel).toContain('reMarkable')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('handles connection failure gracefully', async () => {
      // Device pointing to wrong port
      const badDevice: DeviceConfig = {
        id: 'bad-dev',
        nickname: 'Bad',
        deviceIp: '127.0.0.1',
        sshPort: 1, // invalid port
        authMethod: 'password',
        sshPassword: 'test',
      }
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [badDevice],
        activeDeviceId: 'bad-dev',
      })

      const app = await createApp(config)
      try {
        const res = await app.inject({ method: 'POST', url: '/api/devices/bad-dev/test-connection' })
        expect(res.statusCode).toBe(500)
        const body = JSON.parse(res.body)
        expect(body.error).toContain('Connection failed')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── setup-keys ─────────────────────────────────────────────────────────

  describe('setup-keys', () => {
    it('generates keypair and installs pubkey on device', async () => {
      createDevice(config, mockServer)
      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/setup-keys',
        })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.body)
        expect(body.ok).toBe(true)

        // Key files should exist locally
        const sshDir = resolve(config.sshDir, 'test-dev-1')
        expect(existsSync(resolve(sshDir, 'id_remarkable'))).toBe(true)
        expect(existsSync(resolve(sshDir, 'id_remarkable.pub'))).toBe(true)

        // Public key should be installed on mock device
        const authKeys = readFileSync(
          resolve(mockServer.fsRoot, 'home/root/.ssh/authorized_keys'),
          'utf8',
        )
        expect(authKeys).toContain('ssh-rsa')
        expect(authKeys).toContain('remarkable-templates')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('switches device auth to key-based', async () => {
      createDevice(config, mockServer)
      const app = await createApp(config)
      try {
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/setup-keys' })
        const store = JSON.parse(readFileSync(config.deviceConfigPath, 'utf8'))
        const device = store.devices.find((d: DeviceConfig) => d.id === 'test-dev-1')
        expect(device.authMethod).toBe('key')
        expect(device.privateKeyPath).toBeTruthy()
        expect(device.sshPassword).toBeUndefined()
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('subsequent connection works with new key', async () => {
      createDevice(config, mockServer)
      const app = await createApp(config)
      try {
        // Setup keys (switches to key auth)
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/setup-keys' })

        // Now test connection — should use key auth
        const res = await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/test-connection' })
        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.body).ok).toBe(true)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── sync-status ────────────────────────────────────────────────────────

  describe('sync-status', () => {
    it('returns correct summary when device has no manifest', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'Grid')
      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/sync-status',
        })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.body)
        expect(body.ok).toBe(true)
        expect(body.summary.localOnly).toBeGreaterThanOrEqual(1)
        expect(body.checkedAt).toBeTruthy()
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('identifies synced and device-only templates', async () => {
      const uuid1 = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
      const uuid2 = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'

      // Seed device with two templates
      seedMethodsTemplates(mockServer.fsRoot, [
        { uuid: uuid1, name: 'DeviceGrid', contentHash: 'sha256:hash1' },
        { uuid: uuid2, name: 'DeviceLines', contentHash: 'sha256:hash2' },
      ])

      // Only add uuid1 locally with matching hash
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'Grid', uuid1)

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/sync-status',
        })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.body)
        expect(body.ok).toBe(true)
        // uuid2 should be device-only
        expect(body.summary.deviceOnly).toBeGreaterThanOrEqual(1)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── deploy-methods (full) ─────────────────────────────────────────────

  describe('deploy-methods (full)', () => {
    it('builds and pushes templates to device', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'DeployTest')

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/deploy-methods',
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const doneEvent = events.find(e => e.type === 'done')
        expect(doneEvent).toBeTruthy()
        expect(doneEvent!.ok).toBe(true)
        expect(doneEvent!.steps).toBeDefined()
        expect(Array.isArray(doneEvent!.steps)).toBe(true)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('writes device manifest on device', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'ManifestTest')

      const app = await createApp(config)
      try {
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })

        // Device manifest should exist
        const manifestPath = resolve(
          mockServer.fsRoot,
          'home/root/.local/share/remarkable/xochitl/.remarkable-templates-deployed',
        )
        expect(existsSync(manifestPath)).toBe(true)
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
        expect(manifest.exportedAt).toBeTruthy()
        expect(Object.keys(manifest.templates).length).toBeGreaterThanOrEqual(1)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('creates local .deployed-manifest', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'LocalManifest')

      const app = await createApp(config)
      try {
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })

        const deployedManifest = resolve(config.rmMethodsBackupDir, 'test-dev-1', '.deployed-manifest')
        expect(existsSync(deployedManifest)).toBe(true)
        const manifest = JSON.parse(readFileSync(deployedManifest, 'utf8'))
        expect(Object.keys(manifest.templates).length).toBeGreaterThanOrEqual(1)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('cleans up orphaned templates on re-deploy', async () => {
      createDevice(config, mockServer)
      const orphanUuid = 'orphan00-0000-0000-0000-000000000000'

      // First deploy: one template
      seedCustomTemplate(config, 'First', orphanUuid)
      const app = await createApp(config)
      try {
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })

        // Verify orphan template exists on device
        const xochitlDir = resolve(mockServer.fsRoot, 'home/root/.local/share/remarkable/xochitl')
        expect(existsSync(resolve(xochitlDir, `${orphanUuid}.template`))).toBe(true)

        // Second deploy: different template (orphan should be removed)
        // Replace the custom registry entirely
        const newUuid = 'newuuid0-0000-0000-0000-000000000000'
        writeFileSync(config.customRegistry, JSON.stringify({
          templates: [{
            name: 'Second',
            filename: 'custom/P Second',
            iconCode: '\ue9d8',
            landscape: false,
            categories: ['Custom'],
            rmMethodsId: newUuid,
          }],
        }))
        writeFileSync(resolve(config.customDir, 'P Second.template'), validTemplate)

        const res2 = await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })
        const events = parseNdjson(res2.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()

        // Orphan should be removed from device
        expect(existsSync(resolve(xochitlDir, `${orphanUuid}.template`))).toBe(false)
        // New template should exist
        expect(existsSync(resolve(xochitlDir, `${newUuid}.template`))).toBe(true)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('streams NDJSON progress events', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'ProgressTest')

      const app = await createApp(config)
      try {
        const res = await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })
        const events = parseNdjson(res.body)
        const progressEvents = events.filter(e => e.type === 'progress')
        expect(progressEvents.length).toBeGreaterThan(0)
        // Should include phases like building, connecting, pushing
        const phases = progressEvents.map(e => e.phase)
        expect(phases.some(p => typeof p === 'string' && p.toLowerCase().includes('build'))).toBe(true)
        expect(phases.some(p => typeof p === 'string' && p.toLowerCase().includes('connect'))).toBe(true)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── deploy-methods (selective) ────────────────────────────────────────

  describe('deploy-methods (selective)', () => {
    it('pushes only selected UUIDs', async () => {
      createDevice(config, mockServer)
      const uuid1 = 'sel-uuid1-0000-0000-0000-000000000000'
      const uuid2 = 'sel-uuid2-0000-0000-0000-000000000000'
      seedCustomTemplate(config, 'Template1', uuid1)
      seedCustomTemplate(config, 'Template2', uuid2)

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/deploy-methods',
          payload: { templateIds: [uuid1] },
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()

        // Only uuid1 files should be on device
        const xochitlDir = resolve(mockServer.fsRoot, 'home/root/.local/share/remarkable/xochitl')
        expect(existsSync(resolve(xochitlDir, `${uuid1}.template`))).toBe(true)
        // uuid2 should NOT have been pushed
        expect(existsSync(resolve(xochitlDir, `${uuid2}.template`))).toBe(false)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('merges with existing deployed manifest', async () => {
      createDevice(config, mockServer)
      const uuid1 = 'merge-u1-0000-0000-0000-000000000000'
      const uuid2 = 'merge-u2-0000-0000-0000-000000000000'
      seedCustomTemplate(config, 'Merge1', uuid1)
      seedCustomTemplate(config, 'Merge2', uuid2)

      const app = await createApp(config)
      try {
        // Full deploy first
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })

        // Now add a third template and selective-deploy only it
        const uuid3 = 'merge-u3-0000-0000-0000-000000000000'
        seedCustomTemplate(config, 'Merge3', uuid3)

        await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/deploy-methods',
          payload: { templateIds: [uuid3] },
        })

        // Deployed manifest should have all three
        const deployedManifest = resolve(config.rmMethodsBackupDir, 'test-dev-1', '.deployed-manifest')
        const manifest = JSON.parse(readFileSync(deployedManifest, 'utf8'))
        expect(manifest.templates[uuid1]).toBeTruthy()
        expect(manifest.templates[uuid2]).toBeTruthy()
        expect(manifest.templates[uuid3]).toBeTruthy()
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── deploy-classic ────────────────────────────────────────────────────

  describe('deploy-classic', () => {
    it('pushes to /usr/share/remarkable/templates/', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'ClassicTest')
      // Need official templates for classic build
      writeFileSync(
        resolve(config.officialDir, 'templates.json'),
        JSON.stringify({ templates: [{ name: 'Official', filename: 'P Official', iconCode: '\ue9d8', landscape: false, categories: ['Lines'] }] }),
      )
      writeFileSync(resolve(config.officialDir, 'P Official.template'), validTemplate)

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/deploy-classic',
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()
        expect(done!.ok).toBe(true)

        // templates.json should exist on device
        const deviceTemplatesJson = resolve(
          mockServer.fsRoot,
          'usr/share/remarkable/templates/templates.json',
        )
        expect(existsSync(deviceTemplatesJson)).toBe(true)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── pull-methods ──────────────────────────────────────────────────────

  describe('pull-methods', () => {
    it('discovers TemplateType metadata on device', async () => {
      createDevice(config, mockServer)
      const uuid = 'pull-uuid-0000-0000-0000-000000000000'
      seedMethodsTemplates(mockServer.fsRoot, [{ uuid, name: 'PulledTemplate' }])

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/pull-methods',
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()
        expect((done!.count as number)).toBeGreaterThanOrEqual(1)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('handles device with no methods templates', async () => {
      createDevice(config, mockServer)

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/pull-methods',
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()
        expect(done!.count).toBe(0)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── pull-official ─────────────────────────────────────────────────────

  describe('pull-official', () => {
    it('copies classic templates from device', async () => {
      createDevice(config, mockServer)
      seedClassicTemplates(mockServer.fsRoot, [
        { filename: 'P Lines Medium', name: 'Lines Medium' },
      ])

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/pull-official',
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()
        expect((done!.count as number)).toBeGreaterThanOrEqual(1)

        // Template files should now exist locally
        expect(existsSync(resolve(config.officialDir, 'templates.json'))).toBe(true)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── rollback-methods ──────────────────────────────────────────────────

  describe('rollback-methods', () => {
    it('reverts device to previous backup state', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'RollbackTest')

      const app = await createApp(config)
      try {
        // Deploy to create initial state
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })

        // Deploy again (with different content) — this creates a backup of the first deploy
        const uuid2 = 'rollback-0000-0000-0000-000000000002'
        seedCustomTemplate(config, 'RollbackTest2', uuid2)
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })

        // Now rollback
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/rollback-methods',
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()
        expect(done!.ok).toBe(true)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('returns 400 when no backup exists', async () => {
      createDevice(config, mockServer)

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/rollback-methods',
        })
        expect(res.statusCode).toBe(400)
        expect(JSON.parse(res.body).error).toContain('No timestamped backups')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── rollback-original ─────────────────────────────────────────────────

  describe('rollback-original', () => {
    it('restores device to pre-app state', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'OriginalRollback')

      const app = await createApp(config)
      try {
        // Deploy first (creates .original backup)
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })

        // Rollback to original
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/rollback-original',
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()
        expect(done!.ok).toBe(true)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('returns 400 when no original backup exists', async () => {
      createDevice(config, mockServer)

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/rollback-original',
        })
        expect(res.statusCode).toBe(400)
        expect(JSON.parse(res.body).error).toContain('No original backup')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── rollback-classic ──────────────────────────────────────────────────

  describe('rollback-classic', () => {
    it('finds latest backup and restores it', async () => {
      createDevice(config, mockServer)
      // Seed a backup tar.gz on the mock device
      const backupsDir = resolve(mockServer.fsRoot, 'home/root/template-backups')
      mkdirSync(backupsDir, { recursive: true })
      writeFileSync(resolve(backupsDir, 'templates_20260318_120000.tar.gz'), 'fake-tar')

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/rollback-classic',
        })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.body)
        expect(body.ok).toBe(true)
        expect(body.restoredFrom).toContain('templates_20260318_120000')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('returns 400 when no backups exist', async () => {
      createDevice(config, mockServer)

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/rollback-classic',
        })
        expect(res.statusCode).toBe(400)
        expect(JSON.parse(res.body).error).toContain('No backups found')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })

  // ─── remove-all ────────────────────────────────────────────────────────

  describe('remove-all', () => {
    it('preview lists deployed UUIDs', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'RemoveTest')

      const app = await createApp(config)
      try {
        // Deploy first
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })

        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/remove-all-preview',
        })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.body)
        expect(body.count).toBeGreaterThanOrEqual(1)
        expect(body.templates).toBeDefined()
        expect(body.templates.length).toBeGreaterThanOrEqual(1)
        expect(body.templates[0].uuid).toBeTruthy()
        expect(body.templates[0].name).toBeTruthy()
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('execute removes files and creates backup ZIP', async () => {
      createDevice(config, mockServer)
      seedCustomTemplate(config, 'RemoveExec')

      const app = await createApp(config)
      try {
        // Deploy first
        await app.inject({ method: 'POST', url: '/api/devices/test-dev-1/deploy-methods' })

        // Execute remove-all
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/remove-all-execute',
        })
        expect(res.statusCode).toBe(200)
        const events = parseNdjson(res.body)
        const done = events.find(e => e.type === 'done')
        expect(done).toBeTruthy()
        expect(done!.ok).toBe(true)
        expect(done!.backupFilename).toBeTruthy()
        expect((done!.backupFilename as string)).toMatch(/remove-all-backup.*\.zip/)

        // Device manifest should be gone
        const manifestPath = resolve(
          mockServer.fsRoot,
          'home/root/.local/share/remarkable/xochitl/.remarkable-templates-deployed',
        )
        expect(existsSync(manifestPath)).toBe(false)

        // Local .deployed-manifest should be gone
        const deployedManifest = resolve(config.rmMethodsBackupDir, 'test-dev-1', '.deployed-manifest')
        expect(existsSync(deployedManifest)).toBe(false)
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)

    it('returns error when no deploy history exists', async () => {
      createDevice(config, mockServer)

      const app = await createApp(config)
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/devices/test-dev-1/remove-all-preview',
        })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.body)
        expect(body.count).toBe(0)
        expect(body.error).toContain('No deploy history')
      } finally {
        await app.close()
      }
    }, TEST_TIMEOUT)
  })
})
