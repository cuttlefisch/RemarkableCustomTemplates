import { useState, useEffect, useCallback } from 'react'
import { refreshDeviceMenu } from './useElectronIPC'
import { deviceModelToDeviceId, setPreferredDeviceType } from '../lib/renderer'

/** Persisted device configuration returned by the server. */
export interface DeviceData {
  id: string
  nickname: string
  deviceIp: string
  sshPort: number
  authMethod: 'password' | 'key'
  lastConnected?: string
  deviceModel?: string
  firmwareVersion?: string
}

/** Return type of `useDevices` — device list state and CRUD/connection operations. */
export interface UseDevices {
  loading: boolean
  devices: DeviceData[]
  activeDeviceId: string | null
  activeDevice: DeviceData | null
  error: string | null
  refresh: () => Promise<void>
  addDevice: (cfg: {
    nickname: string
    deviceIp: string
    sshPort: number
    authMethod: string
    sshPassword?: string
  }) => Promise<DeviceData | null>
  updateDevice: (id: string, cfg: Partial<{
    nickname: string
    deviceIp: string
    sshPort: number
    authMethod: string
    sshPassword?: string
  }>) => Promise<boolean>
  removeDevice: (id: string) => Promise<boolean>
  setActiveDevice: (id: string) => Promise<boolean>
  testConnection: (id: string, override?: {
    deviceIp: string
    sshPort: number
    authMethod: string
    sshPassword?: string
  }) => Promise<{ ok: boolean; deviceModel?: string; firmwareVersion?: string; error?: string; hint?: string; rawError?: string }>
  setupKeys: (id: string) => Promise<{ ok: boolean; error?: string; hint?: string; rawError?: string }>
}

/**
 * Multi-device management hook. Fetches devices on mount, re-fetches on Electron menu changes,
 * and provides CRUD operations, connection testing, and SSH key setup.
 *
 * @returns Device list, active device, and mutation/connection functions.
 */
export function useDevices(): UseDevices {
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState<DeviceData[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [devicesRes, activeRes] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/devices/active'),
      ])
      if (!devicesRes.ok) throw new Error(`HTTP ${devicesRes.status}`)
      const devicesData = (await devicesRes.json()) as { devices: DeviceData[] }
      setDevices(devicesData.devices)

      if (activeRes.ok) {
        const activeData = (await activeRes.json()) as { activeDeviceId: string | null }
        setActiveDeviceId(activeData.activeDeviceId)
      }
      setError(null)
    } catch (e) {
      setError(`Failed to load devices: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Re-fetch when Electron menu changes the active device
  useEffect(() => {
    const handler = () => { refresh() }
    window.addEventListener('devices-changed', handler)
    return () => window.removeEventListener('devices-changed', handler)
  }, [refresh])

  const activeDevice = devices.find(d => d.id === activeDeviceId) ?? devices[0] ?? null

  // Sync preferred device type from the active device's model on startup/change
  useEffect(() => {
    if (activeDevice?.deviceModel) {
      const mapped = deviceModelToDeviceId(activeDevice.deviceModel)
      if (mapped) setPreferredDeviceType(mapped)
    }
  }, [activeDevice?.deviceModel])

  const addDevice = useCallback(async (cfg: {
    nickname: string
    deviceIp: string
    sshPort: number
    authMethod: string
    sshPassword?: string
  }): Promise<DeviceData | null> => {
    try {
      setError(null)
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? `HTTP ${res.status}`)
        return null
      }
      const data = (await res.json()) as { device: DeviceData }
      await refresh()
      refreshDeviceMenu()
      return data.device
    } catch (e) {
      setError(`Add failed: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }
  }, [refresh])

  const updateDevice = useCallback(async (id: string, cfg: Partial<{
    nickname: string
    deviceIp: string
    sshPort: number
    authMethod: string
    sshPassword?: string
  }>): Promise<boolean> => {
    try {
      setError(null)
      const res = await fetch(`/api/devices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? `HTTP ${res.status}`)
        return false
      }
      await refresh()
      refreshDeviceMenu()
      return true
    } catch (e) {
      setError(`Update failed: ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }, [refresh])

  const removeDevice = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null)
      const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? `HTTP ${res.status}`)
        return false
      }
      await refresh()
      refreshDeviceMenu()
      return true
    } catch (e) {
      setError(`Remove failed: ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }, [refresh])

  const setActiveDeviceFn = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null)
      const res = await fetch('/api/devices/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: id }),
      })
      if (!res.ok) return false
      setActiveDeviceId(id)
      refreshDeviceMenu()
      return true
    } catch (err) {
      console.error('[set-active-device]', err instanceof Error ? err.message : String(err))
      return false
    }
  }, [])

  const testConnection = useCallback(async (id: string, override?: {
    deviceIp: string
    sshPort: number
    authMethod: string
    sshPassword?: string
  }) => {
    try {
      setError(null)
      const res = await fetch(`/api/devices/${id}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(override ?? {}),
      })
      const data = (await res.json()) as {
        ok?: boolean
        deviceModel?: string
        firmwareVersion?: string
        lastConnected?: string
        error?: string
        hint?: string
        rawError?: string
      }
      if (!res.ok) {
        console.error('[test-connection]', data.rawError ?? data.error)
        return { ok: false, error: data.error ?? `HTTP ${res.status}`, hint: data.hint, rawError: data.rawError }
      }
      await refresh()
      return { ok: true, deviceModel: data.deviceModel, firmwareVersion: data.firmwareVersion }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[test-connection]', msg)
      return { ok: false, error: msg, rawError: msg }
    }
  }, [refresh])

  const setupKeys = useCallback(async (id: string) => {
    try {
      setError(null)
      const res = await fetch(`/api/devices/${id}/setup-keys`, { method: 'POST' })
      const data = (await res.json()) as { ok?: boolean; error?: string; hint?: string; rawError?: string }
      if (!res.ok) {
        console.error('[setup-keys]', data.rawError ?? data.error)
        return { ok: false, error: data.error ?? `HTTP ${res.status}`, hint: data.hint, rawError: data.rawError }
      }
      await refresh()
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[setup-keys]', msg)
      return { ok: false, error: msg, rawError: msg }
    }
  }, [refresh])

  return {
    loading,
    devices,
    activeDeviceId,
    activeDevice,
    error,
    refresh,
    addDevice,
    updateDevice,
    removeDevice,
    setActiveDevice: setActiveDeviceFn,
    testConnection,
    setupKeys,
  }
}
