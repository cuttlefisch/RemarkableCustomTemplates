import { useState, useEffect, useCallback } from 'react'

export interface DeviceData {
  id: string
  nickname: string
  deviceIp: string
  sshPort: number
  authMethod: 'password' | 'key'
  lastConnected?: string
  deviceModel?: string
}

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
  }) => Promise<{ ok: boolean; deviceModel?: string; error?: string; hint?: string; rawError?: string }>
  setupKeys: (id: string) => Promise<{ ok: boolean; error?: string; hint?: string; rawError?: string }>
}

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

  const activeDevice = devices.find(d => d.id === activeDeviceId) ?? devices[0] ?? null

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
      return true
    } catch {
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
      return { ok: true, deviceModel: data.deviceModel }
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
