/**
 * Electron main process.
 * Starts the Fastify server on a random localhost port,
 * then opens a BrowserWindow pointing at it.
 */

import { app, BrowserWindow } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../server/app.ts'
import { resolveConfig } from '../server/config.ts'
import { seedDataDir } from './seed.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let fastifyApp: Awaited<ReturnType<typeof createApp>> | null = null

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

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'RM Custom Templates',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${port}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  const port = await startServer()
  createWindow(port)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port)
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
