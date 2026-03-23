/**
 * Bridge between Electron IPC events and the React app.
 *
 * In a browser (Docker/dev), window.electronAPI is undefined and this is a no-op.
 * In Electron, it listens for menu-triggered navigation and device actions,
 * and signals the main process to rebuild menus after device state changes.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface ElectronAPI {
  version: string
  refreshDeviceMenu: () => Promise<boolean>
  onNavigate: (callback: (path: string) => void) => () => void
  onDeviceAction: (callback: (action: string, deviceId: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

/** Returns true if running inside Electron */
export function isElectron(): boolean {
  return !!window.electronAPI?.refreshDeviceMenu
}

/** Tell Electron to rebuild the Device menu with current server state */
export function refreshDeviceMenu(): void {
  window.electronAPI?.refreshDeviceMenu()
}

/**
 * Hook: listens for Electron menu navigation events and routes them
 * through react-router. Must be called inside a <Router>.
 */
export function useElectronNavigation(): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!window.electronAPI) return

    const cleanupNav = window.electronAPI.onNavigate((path: string) => {
      navigate(path)
    })

    const cleanupAction = window.electronAPI.onDeviceAction((action: string, _deviceId: string) => {
      if (action === 'set-active') {
        // Dispatch a custom event so useDevices() refetches
        window.dispatchEvent(new CustomEvent('devices-changed'))
      }
    })

    return () => {
      cleanupNav()
      cleanupAction()
    }
  }, [navigate])
}
