// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'
import { writeDeviceStore } from '../lib/deviceStore.ts'

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `devroutes-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(base, 'public/templates/custom'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/debug'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/methods'), { recursive: true })
  mkdirSync(resolve(base, 'remarkable_official_templates'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-dist'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-backups'), { recursive: true })
  mkdirSync(resolve(base, 'data/ssh'), { recursive: true })
  return resolveConfig({ dataDir: base, port: 0, production: false })
}

describe('device routes (/api/devices)', () => {
  let config: ServerConfig

  beforeEach(() => {
    config = makeConfig()
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
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
      expect(body.devices[0].sshPassword).toBe('***')
      expect(body.devices[0].nickname).toBe('My RM')
      expect(body.activeDeviceId).toBe('dev-1')
      await app.close()
    })
  })

  describe('POST /api/devices', () => {
    it('creates a device and returns it with an auto-generated ID', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices',
        payload: {
          nickname: 'Office RM',
          deviceIp: '10.11.99.1',
          authMethod: 'password',
          sshPassword: 'test',
        },
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.device).toBeTruthy()
      expect(body.device.id).toBeTruthy()
      expect(body.device.nickname).toBe('Office RM')
      expect(body.device.deviceIp).toBe('10.11.99.1')
      expect(body.device.sshPassword).toBe('***') // redacted in response

      // Verify persisted
      const store = JSON.parse(readFileSync(config.deviceConfigPath, 'utf8'))
      expect(store.version).toBe(2)
      expect(store.devices).toHaveLength(1)
      // First device becomes active
      expect(store.activeDeviceId).toBe(body.device.id)
      await app.close()
    })
  })

  describe('PUT /api/devices/:id', () => {
    it('updates an existing device', async () => {
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [{
          id: 'upd-1',
          nickname: 'Old Name',
          deviceIp: '10.11.99.1',
          sshPort: 22,
          authMethod: 'password',
        }],
        activeDeviceId: 'upd-1',
      })

      const app = await createApp(config)
      const res = await app.inject({
        method: 'PUT',
        url: '/api/devices/upd-1',
        payload: { nickname: 'New Name', deviceIp: '10.11.99.2' },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.nickname).toBe('New Name')
      expect(body.deviceIp).toBe('10.11.99.2')
      expect(body.id).toBe('upd-1') // ID unchanged
      await app.close()
    })

    it('returns 404 for non-existent device', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'PUT',
        url: '/api/devices/nonexistent',
        payload: { nickname: 'Nope' },
      })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('DELETE /api/devices/:id', () => {
    it('removes a device', async () => {
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [{
          id: 'del-1',
          nickname: 'To Delete',
          deviceIp: '10.11.99.1',
          sshPort: 22,
          authMethod: 'password',
        }],
        activeDeviceId: 'del-1',
      })

      const app = await createApp(config)
      const res = await app.inject({ method: 'DELETE', url: '/api/devices/del-1' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ ok: true })

      // Verify removed
      const listRes = await app.inject({ method: 'GET', url: '/api/devices' })
      const list = JSON.parse(listRes.body)
      expect(list.devices).toHaveLength(0)
      expect(list.activeDeviceId).toBeNull()
      await app.close()
    })

    it('returns 404 for non-existent device', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'DELETE', url: '/api/devices/ghost' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('GET /api/devices/active', () => {
    it('returns null when no active device', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/devices/active' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).activeDeviceId).toBeNull()
      await app.close()
    })

    it('returns active device', async () => {
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [{
          id: 'act-1',
          nickname: 'Active',
          deviceIp: '10.11.99.1',
          sshPort: 22,
          authMethod: 'password',
        }],
        activeDeviceId: 'act-1',
      })

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/devices/active' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.activeDeviceId).toBe('act-1')
      expect(body.device.nickname).toBe('Active')
      await app.close()
    })
  })

  describe('POST /api/devices/active', () => {
    it('sets active device', async () => {
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [
          { id: 'a', nickname: 'A', deviceIp: '1.1.1.1', sshPort: 22, authMethod: 'password' },
          { id: 'b', nickname: 'B', deviceIp: '2.2.2.2', sshPort: 22, authMethod: 'password' },
        ],
        activeDeviceId: 'a',
      })

      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/active',
        payload: { deviceId: 'b' },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).activeDeviceId).toBe('b')
      await app.close()
    })

    it('returns 400 for non-existent device', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/devices/active',
        payload: { deviceId: 'nope' },
      })
      expect(res.statusCode).toBe(400)
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

    it('lists available backups for a device', async () => {
      writeDeviceStore(config.deviceConfigPath, {
        version: 2,
        devices: [{ id: 'bk-2', nickname: 'BK2', deviceIp: '1.1.1.1', sshPort: 22, authMethod: 'password' }],
        activeDeviceId: 'bk-2',
      })

      // Create per-device backup dir with a timestamped backup
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
