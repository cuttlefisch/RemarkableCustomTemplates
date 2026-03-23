/**
 * Data directory seeding for Electron.
 * Creates the expected directory structure and syncs bundled system templates
 * (debug + samples) from extraResources on every launch so they stay current.
 * User data (custom/, methods/, notebooks, device config) is never touched.
 */

import { existsSync, mkdirSync, cpSync } from 'node:fs'
import { join } from 'node:path'

const DATA_DIRS = [
  'public/templates/custom',
  'public/templates/methods',
  'public/templates/debug',
  'public/templates/samples',
  'rm-methods-dist',
  'rm-methods-backups',
  'notebook-dist',
  'data/ssh',
  'data/backups',
]

/** Directories containing system templates that should always match the bundled version. */
const SYSTEM_TEMPLATE_DIRS = [
  { src: 'templates/debug', dest: 'public/templates/debug' },
  { src: 'templates/samples', dest: 'public/templates/samples' },
]

export function seedDataDir(dataDir: string, resourcesPath: string): void {
  // Ensure all data directories exist
  for (const dir of DATA_DIRS) {
    mkdirSync(join(dataDir, dir), { recursive: true })
  }

  // Always sync system template directories from bundled resources.
  // These are read-only system templates that should match the current app version.
  for (const { src, dest } of SYSTEM_TEMPLATE_DIRS) {
    const srcPath = join(resourcesPath, src)
    if (existsSync(srcPath)) {
      cpSync(srcPath, join(dataDir, dest), { recursive: true, force: true })
    }
  }
}
