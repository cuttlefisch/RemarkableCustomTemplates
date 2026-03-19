// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  readDeviceStore,
  writeDeviceStore,
  readDevice,
  writeDevice,
  removeDevice,
  getActiveDevice,
  setActiveDevice,
  listDevices,
  type DeviceStore,
} from '../lib/deviceStore.ts'
import type { DeviceConfig } from '../lib/ssh.ts'

function makeTmpDir(): string {
  const dir = resolve(tmpdir(), `devicestore-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(dir, 'data/ssh'), { recursive: true })
  return dir
}

function configPath(base: string): string {
  return resolve(base, 'data/device-config.json')
}

function makeDevice(overrides?: Partial<DeviceConfig>): DeviceConfig {
  return {
    id: overrides?.id ?? 'test-id-1',
    nickname: overrides?.nickname ?? 'Test Device',
    deviceIp: overrides?.deviceIp ?? '10.11.99.1',
    sshPort: overrides?.sshPort ?? 22,
    authMethod: overrides?.authMethod ?? 'password',
    sshPassword: overrides?.sshPassword ?? 'secret',
    ...overrides,
  }
}

describe('deviceStore', () => {
  let base: string

  beforeEach(() => {
    base = makeTmpDir()
  })

  afterEach(() => {
    rmSync(base, { recursive: true, force: true })
  })

  describe('readDeviceStore', () => {
    it('returns empty store when file does not exist', () => {
      const store = readDeviceStore(configPath(base))
      expect(store).toEqual({ version: 2, devices: [], activeDeviceId: null })
    })

    it('reads a v2 store as-is', () => {
      const existing: DeviceStore = {
        version: 2,
        devices: [makeDevice()],
        activeDeviceId: 'test-id-1',
      }
      mkdirSync(resolve(base, 'data'), { recursive: true })
      writeFileSync(configPath(base), JSON.stringify(existing))

      const store = readDeviceStore(configPath(base))
      expect(store.version).toBe(2)
      expect(store.devices).toHaveLength(1)
      expect(store.devices[0].nickname).toBe('Test Device')
      expect(store.activeDeviceId).toBe('test-id-1')
    })

    it('auto-migrates v1 config to v2', () => {
      const v1 = {
        deviceIp: '10.11.99.1',
        sshPort: 22,
        authMethod: 'password',
        sshPassword: 'mypass',
        lastConnected: '2026-03-18T10:00:00Z',
      }
      mkdirSync(resolve(base, 'data'), { recursive: true })
      writeFileSync(configPath(base), JSON.stringify(v1))

      const store = readDeviceStore(configPath(base))
      expect(store.version).toBe(2)
      expect(store.devices).toHaveLength(1)

      const device = store.devices[0]
      expect(device.id).toBeTruthy()
      expect(device.nickname).toBe('My reMarkable')
      expect(device.deviceIp).toBe('10.11.99.1')
      expect(device.sshPassword).toBe('mypass')
      expect(device.lastConnected).toBe('2026-03-18T10:00:00Z')
      expect(store.activeDeviceId).toBe(device.id)

      // Check that the migrated store was written back to disk
      const onDisk = JSON.parse(readFileSync(configPath(base), 'utf8'))
      expect(onDisk.version).toBe(2)
    })

    it('migrates v1 SSH key to per-device directory', () => {
      const sshDir = resolve(base, 'data/ssh')
      mkdirSync(sshDir, { recursive: true })
      const oldKeyPath = resolve(sshDir, 'id_remarkable')
      writeFileSync(oldKeyPath, 'FAKE_KEY_DATA')
      writeFileSync(oldKeyPath + '.pub', 'FAKE_PUB_DATA')

      const v1 = {
        deviceIp: '10.11.99.1',
        sshPort: 22,
        authMethod: 'key',
        privateKeyPath: oldKeyPath,
      }
      mkdirSync(resolve(base, 'data'), { recursive: true })
      writeFileSync(configPath(base), JSON.stringify(v1))

      const store = readDeviceStore(configPath(base))
      const device = store.devices[0]

      // Key should have been moved to per-device dir
      expect(device.privateKeyPath).toContain(device.id)
      expect(existsSync(device.privateKeyPath!)).toBe(true)
      expect(readFileSync(device.privateKeyPath!, 'utf8')).toBe('FAKE_KEY_DATA')
      // Old key should be gone
      expect(existsSync(oldKeyPath)).toBe(false)
    })

    it('returns empty store for invalid JSON', () => {
      mkdirSync(resolve(base, 'data'), { recursive: true })
      writeFileSync(configPath(base), 'not valid json!!!')

      const store = readDeviceStore(configPath(base))
      expect(store).toEqual({ version: 2, devices: [], activeDeviceId: null })
    })
  })

  describe('writeDeviceStore', () => {
    it('creates parent directories and writes JSON', () => {
      const store: DeviceStore = {
        version: 2,
        devices: [makeDevice()],
        activeDeviceId: 'test-id-1',
      }
      writeDeviceStore(configPath(base), store)

      const onDisk = JSON.parse(readFileSync(configPath(base), 'utf8'))
      expect(onDisk.version).toBe(2)
      expect(onDisk.devices).toHaveLength(1)
    })
  })

  describe('readDevice', () => {
    it('returns device by ID', () => {
      writeDeviceStore(configPath(base), {
        version: 2,
        devices: [makeDevice({ id: 'aaa' }), makeDevice({ id: 'bbb', nickname: 'Second' })],
        activeDeviceId: 'aaa',
      })

      const device = readDevice(configPath(base), 'bbb')
      expect(device).not.toBeNull()
      expect(device!.nickname).toBe('Second')
    })

    it('returns null for non-existent ID', () => {
      writeDeviceStore(configPath(base), { version: 2, devices: [], activeDeviceId: null })
      expect(readDevice(configPath(base), 'nope')).toBeNull()
    })
  })

  describe('writeDevice', () => {
    it('adds a new device', () => {
      writeDeviceStore(configPath(base), { version: 2, devices: [], activeDeviceId: null })
      writeDevice(configPath(base), makeDevice({ id: 'new-1' }))

      const store = readDeviceStore(configPath(base))
      expect(store.devices).toHaveLength(1)
      expect(store.devices[0].id).toBe('new-1')
    })

    it('updates an existing device', () => {
      writeDeviceStore(configPath(base), {
        version: 2,
        devices: [makeDevice({ id: 'upd-1', nickname: 'Old Name' })],
        activeDeviceId: 'upd-1',
      })

      writeDevice(configPath(base), makeDevice({ id: 'upd-1', nickname: 'New Name' }))

      const store = readDeviceStore(configPath(base))
      expect(store.devices).toHaveLength(1)
      expect(store.devices[0].nickname).toBe('New Name')
    })
  })

  describe('removeDevice', () => {
    it('removes a device by ID', () => {
      writeDeviceStore(configPath(base), {
        version: 2,
        devices: [makeDevice({ id: 'rm-1' }), makeDevice({ id: 'rm-2' })],
        activeDeviceId: 'rm-1',
      })

      removeDevice(configPath(base), 'rm-1')

      const store = readDeviceStore(configPath(base))
      expect(store.devices).toHaveLength(1)
      expect(store.devices[0].id).toBe('rm-2')
    })

    it('clears activeDeviceId if the active device is removed', () => {
      writeDeviceStore(configPath(base), {
        version: 2,
        devices: [makeDevice({ id: 'only-1' })],
        activeDeviceId: 'only-1',
      })

      removeDevice(configPath(base), 'only-1')

      const store = readDeviceStore(configPath(base))
      expect(store.devices).toHaveLength(0)
      expect(store.activeDeviceId).toBeNull()
    })

    it('falls back to first device when active is removed and others exist', () => {
      writeDeviceStore(configPath(base), {
        version: 2,
        devices: [makeDevice({ id: 'a' }), makeDevice({ id: 'b' })],
        activeDeviceId: 'a',
      })

      removeDevice(configPath(base), 'a')

      const store = readDeviceStore(configPath(base))
      expect(store.activeDeviceId).toBe('b')
    })
  })

  describe('getActiveDevice', () => {
    it('returns the active device', () => {
      writeDeviceStore(configPath(base), {
        version: 2,
        devices: [makeDevice({ id: 'act-1', nickname: 'Active' })],
        activeDeviceId: 'act-1',
      })

      const device = getActiveDevice(configPath(base))
      expect(device).not.toBeNull()
      expect(device!.nickname).toBe('Active')
    })

    it('returns null when no active device', () => {
      writeDeviceStore(configPath(base), { version: 2, devices: [], activeDeviceId: null })
      expect(getActiveDevice(configPath(base))).toBeNull()
    })

    it('returns null when activeDeviceId references missing device', () => {
      writeDeviceStore(configPath(base), {
        version: 2,
        devices: [],
        activeDeviceId: 'ghost',
      })
      expect(getActiveDevice(configPath(base))).toBeNull()
    })
  })

  describe('setActiveDevice', () => {
    it('sets active device ID', () => {
      writeDeviceStore(configPath(base), {
        version: 2,
        devices: [makeDevice({ id: 'x' }), makeDevice({ id: 'y' })],
        activeDeviceId: 'x',
      })

      setActiveDevice(configPath(base), 'y')

      const store = readDeviceStore(configPath(base))
      expect(store.activeDeviceId).toBe('y')
    })

    it('throws if device ID does not exist', () => {
      writeDeviceStore(configPath(base), { version: 2, devices: [], activeDeviceId: null })
      expect(() => setActiveDevice(configPath(base), 'nope')).toThrow('Device nope not found')
    })
  })

  describe('listDevices', () => {
    it('returns all devices', () => {
      writeDeviceStore(configPath(base), {
        version: 2,
        devices: [makeDevice({ id: 'l1' }), makeDevice({ id: 'l2' })],
        activeDeviceId: 'l1',
      })

      const devices = listDevices(configPath(base))
      expect(devices).toHaveLength(2)
      expect(devices.map(d => d.id)).toEqual(['l1', 'l2'])
    })

    it('returns empty array for missing file', () => {
      expect(listDevices(configPath(base))).toEqual([])
    })
  })
})
