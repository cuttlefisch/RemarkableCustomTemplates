import { useState, useEffect, useCallback } from 'react'

export interface DeviceConfigData {
  deviceIp: string
  sshPort: number
  authMethod: 'password' | 'key'
  lastConnected?: string
}

export interface UseDeviceConfig {
  loading: boolean
  configured: boolean
  config: DeviceConfigData | null
  connected: boolean | null
  deviceModel: string | null
  error: string | null
  refresh: () => Promise<void>
  testConnection: (override?: {
    deviceIp: string
    sshPort: number
    authMethod: string
    sshPassword?: string
  }) => Promise<{ ok: boolean; deviceModel?: string; error?: string; hint?: string }>
  saveConfig: (cfg: {
    deviceIp: string
    sshPort: number
    authMethod: string
    sshPassword?: string
  }) => Promise<boolean>
  setupKeys: () => Promise<{ ok: boolean; error?: string; hint?: string }>
}

export function useDeviceConfig(): UseDeviceConfig {
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [config, setConfig] = useState<DeviceConfigData | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [deviceModel, setDeviceModel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/device/config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        configured: boolean
        config?: DeviceConfigData
      }
      setConfigured(data.configured)
      setConfig(data.config ?? null)
      setError(null)
    } catch (e) {
      setError(`Failed to load config: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const testConnection = useCallback(
    async (override?: {
      deviceIp: string
      sshPort: number
      authMethod: string
      sshPassword?: string
    }) => {
      try {
        setError(null)
        const res = await fetch('/api/device/test-connection', {
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
        }
        if (!res.ok) {
          setConnected(false)
          return { ok: false, error: data.error ?? `HTTP ${res.status}`, hint: data.hint }
        }
        setConnected(true)
        setDeviceModel(data.deviceModel ?? null)
        if (data.lastConnected && config) {
          setConfig({ ...config, lastConnected: data.lastConnected })
        }
        return { ok: true, deviceModel: data.deviceModel }
      } catch (e) {
        setConnected(false)
        const msg = e instanceof Error ? e.message : String(e)
        return { ok: false, error: msg }
      }
    },
    [config],
  )

  const saveConfig = useCallback(
    async (cfg: {
      deviceIp: string
      sshPort: number
      authMethod: string
      sshPassword?: string
    }) => {
      try {
        setError(null)
        const res = await fetch('/api/device/config', {
          method: 'POST',
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
        setError(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
        return false
      }
    },
    [refresh],
  )

  const setupKeys = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/device/setup-keys', { method: 'POST' })
      const data = (await res.json()) as { ok?: boolean; error?: string; hint?: string; message?: string }
      if (!res.ok) {
        return { ok: false, error: data.error ?? `HTTP ${res.status}`, hint: data.hint }
      }
      await refresh()
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  }, [refresh])

  return {
    loading,
    configured,
    config,
    connected,
    deviceModel,
    error,
    refresh,
    testConnection,
    saveConfig,
    setupKeys,
  }
}
