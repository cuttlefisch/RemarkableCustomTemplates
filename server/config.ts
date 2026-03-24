/**
 * Server configuration and path resolution.
 *
 * All data paths are derived from a single `DATA_DIR` root, making the server
 * portable across environments:
 * - **Native dev**: `DATA_DIR` defaults to `process.cwd()` (project root)
 * - **Docker**: `DATA_DIR=/data` (persistent volume mount)
 * - **Electron**: `DATA_DIR = app.getPath('userData')`
 *
 * Exports {@link resolveConfig} to build a {@link ServerConfig} with all derived paths,
 * and {@link resolveDevicePaths} for per-device backup/SSH directories.
 *
 * @module
 */

import { resolve } from 'node:path'

export interface DevicePaths {
  backupDir: string           // rm-methods-backups/<deviceId>/
  deployedManifest: string    // rm-methods-backups/<deviceId>/.deployed-manifest
  originalBackup: string      // rm-methods-backups/<deviceId>/.original
  sshDir: string              // data/ssh/<deviceId>/
}

/** Resolve per-device paths for backups, manifests, and SSH keys. */
export function resolveDevicePaths(config: ServerConfig, deviceId: string): DevicePaths {
  const backupDir = resolve(config.rmMethodsBackupDir, deviceId)
  return {
    backupDir,
    deployedManifest: resolve(backupDir, '.deployed-manifest'),
    originalBackup: resolve(backupDir, '.original'),
    sshDir: resolve(config.sshDir, deviceId),
  }
}

export interface ServerConfig {
  /** Root directory for all data files */
  dataDir: string
  /** Port to listen on */
  port: number
  /** Whether this is production mode */
  production: boolean

  // Derived paths
  officialDir: string
  customDir: string
  customRegistry: string
  debugDir: string
  debugRegistry: string
  methodsDir: string
  methodsRegistry: string
  samplesDir: string
  samplesPristineDir: string
  samplesRegistry: string
  hiddenSamplesPath: string
  classicDistDir: string
  rmMethodsDistDir: string
  rmMethodsBackupDir: string
  rmMethodsDeployedManifest: string
  rmMethodsOriginalBackup: string
  notebookDistDir: string
  appBackupsDir: string
  deviceConfigPath: string
  sshDir: string
  notebookDraftsPath: string
  hiddenNotebooksPath: string
  /** Override for frontend dist directory (Electron passes this explicitly) */
  frontendDistDir?: string
  /** Override for xovi extensions data directory (Electron passes this explicitly) */
  xoviDataDir?: string
}

/**
 * Builds a complete {@link ServerConfig} by resolving all data directory paths
 * from `DATA_DIR` (env var), with optional overrides for testing or Electron embedding.
 *
 * @param overrides - Optional partial config to override env-based defaults
 * @returns Fully resolved server configuration
 */
export function resolveConfig(overrides?: Partial<Pick<ServerConfig, 'dataDir' | 'port' | 'production' | 'samplesPristineDir' | 'frontendDistDir' | 'xoviDataDir'>>): ServerConfig {
  const dataDir = overrides?.dataDir ?? process.env.DATA_DIR ?? process.cwd()
  const port = overrides?.port ?? (Number(process.env.PORT) || (process.env.NODE_ENV === 'production' ? 3000 : 3001))
  const production = overrides?.production ?? process.env.NODE_ENV === 'production'

  const templatesDir = resolve(dataDir, 'public/templates')

  return {
    dataDir,
    port,
    production,
    officialDir: resolve(dataDir, 'remarkable_official_templates'),
    customDir: resolve(templatesDir, 'custom'),
    customRegistry: resolve(templatesDir, 'custom/custom-registry.json'),
    debugDir: resolve(templatesDir, 'debug'),
    debugRegistry: resolve(templatesDir, 'debug/debug-registry.json'),
    methodsDir: resolve(templatesDir, 'methods'),
    methodsRegistry: resolve(templatesDir, 'methods/methods-registry.json'),
    samplesDir: resolve(templatesDir, 'samples'),
    samplesPristineDir: overrides?.samplesPristineDir ?? (production
      ? resolve(dataDir, '../app/samples-pristine')
      : resolve(templatesDir, 'samples')),
    samplesRegistry: resolve(templatesDir, 'samples/samples-registry.json'),
    hiddenSamplesPath: resolve(templatesDir, 'custom/hidden-samples.json'),
    classicDistDir: resolve(dataDir, 'dist-deploy'),
    rmMethodsDistDir: resolve(dataDir, 'rm-methods-dist'),
    rmMethodsBackupDir: resolve(dataDir, 'rm-methods-backups'),
    rmMethodsDeployedManifest: resolve(dataDir, 'rm-methods-backups/.deployed-manifest'),
    rmMethodsOriginalBackup: resolve(dataDir, 'rm-methods-backups/.original'),
    notebookDistDir: resolve(dataDir, 'notebook-dist'),
    appBackupsDir: resolve(dataDir, 'data/backups'),
    deviceConfigPath: resolve(dataDir, 'data/device-config.json'),
    sshDir: resolve(dataDir, 'data/ssh'),
    notebookDraftsPath: resolve(dataDir, 'data/notebooks.json'),
    hiddenNotebooksPath: resolve(templatesDir, 'custom/hidden-notebooks.json'),
    frontendDistDir: overrides?.frontendDistDir,
    xoviDataDir: overrides?.xoviDataDir,
  }
}
