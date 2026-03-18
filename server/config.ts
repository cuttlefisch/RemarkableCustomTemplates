/**
 * Server configuration: resolves all data paths from DATA_DIR env var.
 *
 * - Native dev: DATA_DIR defaults to process.cwd() (project root)
 * - Docker: DATA_DIR=/data (persistent volume)
 */

import { resolve } from 'node:path'

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
  rmMethodsDistDir: string
  rmMethodsBackupDir: string
  rmMethodsDeployedManifest: string
  rmMethodsOriginalBackup: string
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
    rmMethodsDistDir: resolve(dataDir, 'rm-methods-dist'),
    rmMethodsBackupDir: resolve(dataDir, 'rm-methods-backups'),
    rmMethodsDeployedManifest: resolve(dataDir, 'rm-methods-backups/.deployed-manifest'),
    rmMethodsOriginalBackup: resolve(dataDir, 'rm-methods-backups/.original'),
    deviceConfigPath: resolve(dataDir, 'data/device-config.json'),
    sshDir: resolve(dataDir, 'data/ssh'),
  }
}
