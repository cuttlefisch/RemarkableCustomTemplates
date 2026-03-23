/**
 * Electron preload script.
 * Exposes a safe IPC bridge to the renderer for device menu integration.
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  version: process.env.npm_package_version ?? 'dev',

  // Device menu integration — renderer signals main process to rebuild menus
  refreshDeviceMenu: () => ipcRenderer.invoke('refresh-device-menu'),

  // Quick actions from menu → renderer
  onNavigate: (callback: (path: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.removeListener('navigate', handler)
  },

  onDeviceAction: (callback: (action: string, deviceId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string, deviceId: string) => callback(action, deviceId)
    ipcRenderer.on('device-action', handler)
    return () => ipcRenderer.removeListener('device-action', handler)
  },
})
