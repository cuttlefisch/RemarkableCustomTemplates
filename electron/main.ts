/**
 * Electron main process.
 * Starts the Fastify server on a random localhost port,
 * then opens a BrowserWindow pointing at it.
 *
 * IPC bridge: the renderer can request a device menu refresh after
 * adding/removing/switching devices. The main process queries Fastify
 * via inject() and rebuilds the native menu with current device state.
 */

import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron'

// Enable native Wayland support when available (avoids blurry XWayland rendering)
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../server/app.ts'
import { resolveConfig } from '../server/config.ts'
import { seedDataDir } from './seed.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let fastifyApp: Awaited<ReturnType<typeof createApp>> | null = null
let serverPort = 3000

async function startServer() {
  const isPackaged = app.isPackaged

  const dataDir = isPackaged
    ? app.getPath('userData')
    : process.cwd()

  const resourcesPath = isPackaged
    ? process.resourcesPath
    : join(process.cwd(), 'public')

  const frontendDistDir = isPackaged
    ? join(process.resourcesPath, 'dist')
    : join(process.cwd(), 'dist')

  const samplesPristineDir = isPackaged
    ? join(process.resourcesPath, 'templates', 'samples')
    : join(process.cwd(), 'public', 'templates', 'samples')

  // Seed data directories on first run
  if (isPackaged) {
    seedDataDir(dataDir, resourcesPath)
  }

  const config = resolveConfig({
    dataDir,
    port: 0, // OS picks a free port
    production: true,
    frontendDistDir,
    samplesPristineDir,
  })

  fastifyApp = await createApp(config)

  // Bind to localhost only — desktop app should not be network-accessible
  await fastifyApp.listen({ port: 0, host: '127.0.0.1' })

  const address = fastifyApp.server.address()
  const port = typeof address === 'object' && address ? address.port : 3000
  return port
}

// ── Device data helpers (query Fastify in-process) ──

interface DeviceInfo {
  id: string
  nickname: string
  deviceIp: string
  authMethod?: string
}

interface DeviceState {
  devices: DeviceInfo[]
  activeDeviceId: string | null
}

async function getDeviceState(): Promise<DeviceState> {
  if (!fastifyApp) return { devices: [], activeDeviceId: null }
  try {
    const res = await fastifyApp.inject({ method: 'GET', url: '/api/devices' })
    const data = JSON.parse(res.body) as { devices: DeviceInfo[]; activeDeviceId: string | null }
    return data
  } catch {
    return { devices: [], activeDeviceId: null }
  }
}

async function setActiveDevice(deviceId: string): Promise<void> {
  if (!fastifyApp) return
  await fastifyApp.inject({
    method: 'POST',
    url: '/api/devices/active',
    payload: { deviceId },
    headers: { 'content-type': 'application/json' },
  })
}

async function testDeviceConnection(deviceId: string): Promise<{ ok: boolean; message: string }> {
  if (!fastifyApp) return { ok: false, message: 'Server not ready' }
  try {
    const res = await fastifyApp.inject({
      method: 'POST',
      url: `/api/devices/${deviceId}/test-connection`,
    })
    const data = JSON.parse(res.body) as Record<string, unknown>
    if (res.statusCode === 200) {
      const model = (data.deviceModel as string) || 'reMarkable'
      return { ok: true, message: `Connected to ${model}` }
    }
    return { ok: false, message: (data.error as string) || 'Connection failed' }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}

// ── Menu builder ──

async function buildMenu(port: number): Promise<Electron.Menu> {
  const isMac = process.platform === 'darwin'
  const { devices, activeDeviceId } = await getDeviceState()

  // Build device submenu dynamically
  const deviceSubmenu: Electron.MenuItemConstructorOptions[] = []

  if (devices.length === 0) {
    deviceSubmenu.push({
      label: 'No devices configured',
      enabled: false,
    })
    deviceSubmenu.push({ type: 'separator' })
    deviceSubmenu.push({
      label: 'Add Device...',
      accelerator: 'CmdOrCtrl+D',
      click: () => mainWindow?.webContents.send('navigate', '/device'),
    })
  } else {
    // Device list — radio-style selection
    for (const device of devices) {
      const isActive = device.id === activeDeviceId
      deviceSubmenu.push({
        label: `${device.nickname || device.deviceIp}`,
        type: 'radio',
        checked: isActive,
        click: async () => {
          await setActiveDevice(device.id)
          // Notify renderer to update its state
          mainWindow?.webContents.send('device-action', 'set-active', device.id)
          // Rebuild menu to reflect new active state
          Menu.setApplicationMenu(await buildMenu(port))
        },
      })
    }

    deviceSubmenu.push({ type: 'separator' })

    // Quick actions for active device
    if (activeDeviceId) {
      const active = devices.find(d => d.id === activeDeviceId)
      const label = active?.nickname || 'Device'

      deviceSubmenu.push({
        label: `Test Connection (${label})`,
        accelerator: 'CmdOrCtrl+T',
        click: async () => {
          const result = await testDeviceConnection(activeDeviceId)
          dialog.showMessageBox(mainWindow!, {
            type: result.ok ? 'info' : 'error',
            title: result.ok ? 'Connection Successful' : 'Connection Failed',
            message: result.message,
            buttons: ['OK'],
          })
        },
      })

      deviceSubmenu.push({
        label: `Deploy Templates (${label})...`,
        click: () => {
          mainWindow?.webContents.send('device-action', 'deploy', activeDeviceId)
          mainWindow?.webContents.send('navigate', '/device')
        },
      })

      deviceSubmenu.push({
        label: `Sync Status (${label})...`,
        click: () => {
          mainWindow?.webContents.send('device-action', 'sync-status', activeDeviceId)
          mainWindow?.webContents.send('navigate', '/device')
        },
      })
    }

    deviceSubmenu.push({ type: 'separator' })

    deviceSubmenu.push({
      label: 'Add Device...',
      accelerator: 'CmdOrCtrl+D',
      click: () => mainWindow?.webContents.send('navigate', '/device'),
    })

    deviceSubmenu.push({
      label: 'Manage Devices...',
      click: () => mainWindow?.webContents.send('navigate', '/device'),
    })
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        { label: 'Templates', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.send('navigate', '/') },
        { label: 'Device & Sync', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.send('navigate', '/device') },
        { label: 'Notebook Builder', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.webContents.send('navigate', '/notebook') },
      ],
    },
    {
      label: 'Device',
      submenu: deviceSubmenu,
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
        ...(!isMac ? [
          { type: 'separator' as const },
          {
            label: 'Show Menu Bar',
            type: 'checkbox' as const,
            checked: true,
            click: (menuItem: Electron.MenuItem) => {
              if (mainWindow) {
                mainWindow.setAutoHideMenuBar(!menuItem.checked)
                mainWindow.setMenuBarVisibility(menuItem.checked)
              }
            },
          },
        ] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'GitHub Repository', click: () => shell.openExternal('https://github.com/cuttlefisch/RemarkableCustomTemplates') },
        { label: 'Report an Issue', click: () => shell.openExternal('https://github.com/cuttlefisch/RemarkableCustomTemplates/issues') },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'RM Custom Templates',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${port}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── IPC handlers ──

ipcMain.handle('refresh-device-menu', async () => {
  Menu.setApplicationMenu(await buildMenu(serverPort))
  return true
})

// ── App lifecycle ──

app.whenReady().then(async () => {
  serverPort = await startServer()
  Menu.setApplicationMenu(await buildMenu(serverPort))
  createWindow(serverPort)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(serverPort)
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', async () => {
  if (fastifyApp) {
    await fastifyApp.close()
  }
})
