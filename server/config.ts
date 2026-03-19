/**
 * Server configuration: resolves all data paths from DATA_DIR env var.
 *
 * - Native dev: DATA_DIR defaults to process.cwd() (project root)
 * - Docker: DATA_DIR=/data (persistent volume)
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
  samplesRegistry: string
  hiddenSamplesPath: string
  classicDistDir: string
  rmMethodsDistDir: string
  rmMethodsBackupDir: string
  rmMethodsDeployedManifest: string
  rmMethodsOriginalBackup: string
  appBackupsDir: string
  deviceConfigPath: string
  sshDir: string
}

export function resolveConfig(overrides?: Partial<Pick<ServerConfig, 'dataDir' | 'port' | 'production'>>): ServerConfig {
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
    samplesRegistry: resolve(templatesDir, 'samples/samples-registry.json'),
    hiddenSamplesPath: resolve(templatesDir, 'custom/hidden-samples.json'),
    classicDistDir: resolve(dataDir, 'dist-deploy'),
    rmMethodsDistDir: resolve(dataDir, 'rm-methods-dist'),
    rmMethodsBackupDir: resolve(dataDir, 'rm-methods-backups'),
    rmMethodsDeployedManifest: resolve(dataDir, 'rm-methods-backups/.deployed-manifest'),
    rmMethodsOriginalBackup: resolve(dataDir, 'rm-methods-backups/.original'),
    appBackupsDir: resolve(dataDir, 'data/backups'),
    deviceConfigPath: resolve(dataDir, 'data/device-config.json'),
    sshDir: resolve(dataDir, 'data/ssh'),
  }
}
