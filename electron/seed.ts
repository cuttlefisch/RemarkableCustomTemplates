/**
 * First-run data directory seeding for Electron.
 * Creates the expected directory structure and copies bundled templates
 * from extraResources if they don't already exist. Idempotent.
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

export function seedDataDir(dataDir: string, resourcesPath: string): void {
  for (const dir of DATA_DIRS) {
    mkdirSync(join(dataDir, dir), { recursive: true })
  }

  // Seed debug templates if not present
  const debugRegistry = join(dataDir, 'public/templates/debug/debug-registry.json')
  if (!existsSync(debugRegistry)) {
    const src = join(resourcesPath, 'templates/debug')
    if (existsSync(src)) {
      cpSync(src, join(dataDir, 'public/templates/debug'), { recursive: true })
    }
  }

  // Seed sample templates if not present
  const samplesRegistry = join(dataDir, 'public/templates/samples/samples-registry.json')
  if (!existsSync(samplesRegistry)) {
    const src = join(resourcesPath, 'templates/samples')
    if (existsSync(src)) {
      cpSync(src, join(dataDir, 'public/templates/samples'), { recursive: true })
    }
  }
}
