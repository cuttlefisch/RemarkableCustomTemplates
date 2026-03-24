/**
 * Manifest UUID utilities — TypeScript replacement for scripts/manifest-uuids.py.
 *
 * Handles both JSON manifest and legacy plain-text UUID-per-line formats.
 */

import { readFileSync, existsSync } from 'node:fs'

/**
 * Read sorted template UUIDs from a manifest file on disk.
 * Supports both JSON manifest format (`{ templates: { uuid: ... } }`)
 * and legacy plain-text format (one UUID per line).
 * @param path - Absolute path to the manifest file.
 * @returns Sorted array of UUID strings, or empty array if file is missing/empty.
 */
export function readManifestUuids(path: string): string[] {
  if (!existsSync(path)) return []
  const txt = readFileSync(path, 'utf8').trim()
  if (!txt) return []

  try {
    const m = JSON.parse(txt) as { templates?: Record<string, unknown> }
    return Object.keys(m.templates ?? {}).sort()
  } catch {
    // Legacy plain-text format: one UUID per line
    return txt.split('\n').map(l => l.trim()).filter(Boolean).sort()
  }
}

/**
 * Count the number of template UUIDs in a manifest file.
 * @param path - Absolute path to the manifest file.
 * @returns Number of UUIDs found (0 if file is missing).
 */
export function countManifestUuids(path: string): number {
  return readManifestUuids(path).length
}

/**
 * Compute UUIDs that were removed between two manifest versions.
 * Returns UUIDs present in `oldPath` but absent from `newPath` (set difference).
 * Useful for identifying orphaned templates after a rebuild.
 * @param oldPath - Path to the previous manifest.
 * @param newPath - Path to the current manifest.
 * @returns Sorted array of removed UUIDs.
 */
export function diffManifestUuids(oldPath: string, newPath: string): string[] {
  const oldSet = new Set(readManifestUuids(oldPath))
  const newSet = new Set(readManifestUuids(newPath))
  return [...oldSet].filter(uuid => !newSet.has(uuid)).sort()
}

// CLI entry point — called via `tsx server/lib/manifestUuids.ts`
if (process.argv[1] && process.argv[1].endsWith('manifestUuids.ts')) {
  const args = process.argv.slice(2)
  if (!args.length) {
    console.error('Usage: manifestUuids.ts [--count|--diff] <path> [<path2>]')
    process.exit(1)
  }

  if (args[0] === '--count') {
    console.log(countManifestUuids(args[1]))
  } else if (args[0] === '--diff') {
    const removed = diffManifestUuids(args[1], args[2])
    if (removed.length) console.log(removed.join('\n'))
  } else {
    const uuids = readManifestUuids(args[0])
    if (uuids.length) console.log(uuids.join('\n'))
  }
}
