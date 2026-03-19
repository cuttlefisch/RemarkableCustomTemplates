/**
 * Centralized device config CRUD with v1 -> v2 auto-migration.
 *
 * Storage format (v2):
 *   { "version": 2, "devices": [...], "activeDeviceId": "uuid-1" }
 *
 * v1 was a flat DeviceConfig object (no version field).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DeviceConfig } from './ssh.ts'

export interface DeviceStore {
  version: 2
  devices: DeviceConfig[]
  activeDeviceId: string | null
}

function emptyStore(): DeviceStore {
  return { version: 2, devices: [], activeDeviceId: null }
}

/**
 * Read the device store, auto-migrating v1 -> v2 if needed.
 * Returns an empty store if the file doesn't exist or can't be parsed.
 */
export function readDeviceStore(configPath: string): DeviceStore {
  if (!existsSync(configPath)) return emptyStore()

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return emptyStore()
  }

  // Already v2
  if (raw.version === 2) {
    return raw as unknown as DeviceStore
  }

  // v1: flat DeviceConfig object (no version field)
  // Migrate to v2 envelope
  const v1 = raw as Record<string, unknown>
  const id = randomUUID()
  const device: DeviceConfig = {
    id,
    nickname: 'My reMarkable',
    deviceIp: (v1.deviceIp as string) ?? '',
    sshPort: (v1.sshPort as number) ?? 22,
    authMethod: (v1.authMethod as 'password' | 'key') ?? 'password',
    sshPassword: v1.sshPassword as string | undefined,
    privateKeyPath: v1.privateKeyPath as string | undefined,
    lastConnected: v1.lastConnected as string | undefined,
    deviceModel: v1.deviceModel as string | undefined,
  }

  // Migrate SSH key to per-device directory if it exists
  if (device.privateKeyPath && existsSync(device.privateKeyPath)) {
    const dataDir = dirname(dirname(configPath)) // configPath = data/device-config.json -> go up 2
    const perDeviceSshDir = resolve(dataDir, 'data', 'ssh', id)
    mkdirSync(perDeviceSshDir, { recursive: true })
    const newKeyPath = resolve(perDeviceSshDir, 'id_remarkable')
    try {
      renameSync(device.privateKeyPath, newKeyPath)
      // Also move the .pub file if it exists
      const pubPath = device.privateKeyPath + '.pub'
      if (existsSync(pubPath)) {
        renameSync(pubPath, newKeyPath + '.pub')
      }
      device.privateKeyPath = newKeyPath
    } catch {
      // If rename fails, keep the old path
    }
  }

  const store: DeviceStore = {
    version: 2,
    devices: [device],
    activeDeviceId: id,
  }

  // Write the migrated store back
  writeDeviceStore(configPath, store)

  return store
}

/** Write the device store to disk. */
export function writeDeviceStore(configPath: string, store: DeviceStore): void {
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(store, null, 2), 'utf8')
}

/** Read a single device by ID. Returns null if not found. */
export function readDevice(configPath: string, id: string): DeviceConfig | null {
  const store = readDeviceStore(configPath)
  return store.devices.find(d => d.id === id) ?? null
}

/** Upsert a device: update existing or add new. */
export function writeDevice(configPath: string, device: DeviceConfig): void {
  const store = readDeviceStore(configPath)
  const idx = store.devices.findIndex(d => d.id === device.id)
  if (idx >= 0) {
    store.devices[idx] = device
  } else {
    store.devices.push(device)
  }
  writeDeviceStore(configPath, store)
}

/** Remove a device by ID. Clears activeDeviceId if it was the active device. */
export function removeDevice(configPath: string, id: string): void {
  const store = readDeviceStore(configPath)
  store.devices = store.devices.filter(d => d.id !== id)
  if (store.activeDeviceId === id) {
    store.activeDeviceId = store.devices.length > 0 ? store.devices[0].id : null
  }
  writeDeviceStore(configPath, store)
}

/** Get the active device, or null if none set. */
export function getActiveDevice(configPath: string): DeviceConfig | null {
  const store = readDeviceStore(configPath)
  if (!store.activeDeviceId) return null
  return store.devices.find(d => d.id === store.activeDeviceId) ?? null
}

/** Set the active device by ID. Throws if ID doesn't exist. */
export function setActiveDevice(configPath: string, id: string): void {
  const store = readDeviceStore(configPath)
  if (!store.devices.some(d => d.id === id)) {
    throw new Error(`Device ${id} not found`)
  }
  store.activeDeviceId = id
  writeDeviceStore(configPath, store)
}

/** List all devices. */
export function listDevices(configPath: string): DeviceConfig[] {
  return readDeviceStore(configPath).devices
}
