/**
 * Minimal Electron preload script.
 * Exposes app version to the renderer for future use.
 */

import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  version: process.env.npm_package_version ?? 'dev',
})
