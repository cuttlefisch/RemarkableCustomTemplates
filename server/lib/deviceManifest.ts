/**
 * Device-side deploy manifest — tracks which templates we've deployed.
 *
 * The manifest file on the device is the source of truth for distinguishing
 * our custom-deployed templates from official reMarkable methods templates.
 */

import type { SFTPWrapper } from 'ssh2'
import type { RmMethodsManifest } from '../../src/lib/rmMethods.ts'
import { readRemoteFile, writeRemoteFile } from './sftp.ts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEVICE_MANIFEST_FILENAME = '.remarkable-templates-deployed'
export const RM_METHODS_PATH = '/home/root/.local/share/remarkable/xochitl'
export const DEVICE_MANIFEST_PATH = `${RM_METHODS_PATH}/${DEVICE_MANIFEST_FILENAME}`

// ---------------------------------------------------------------------------
// Pure functions (testable without SSH)
// ---------------------------------------------------------------------------

/** Extract sorted UUIDs from a manifest JSON string. Returns [] on invalid input. */
export function parseManifestUuids(json: string): string[] {
  if (!json) return []
  try {
    const m = JSON.parse(json) as { templates?: Record<string, unknown> }
    return Object.keys(m.templates ?? {}).sort()
  } catch {
    return []
  }
}

/** Merge two UUID arrays into a sorted, deduplicated union. */
export function mergeDeployedUuids(localUuids: string[], deviceUuids: string[]): string[] {
  return [...new Set([...localUuids, ...deviceUuids])].sort()
}

// ---------------------------------------------------------------------------
// SFTP functions
// ---------------------------------------------------------------------------

/** Read the deploy manifest from the device. Returns null if not found. */
export async function readDeviceManifest(sftp: SFTPWrapper): Promise<RmMethodsManifest | null> {
  try {
    const content = await readRemoteFile(sftp, DEVICE_MANIFEST_PATH)
    return JSON.parse(content) as RmMethodsManifest
  } catch {
    return null
  }
}

/** Write the deploy manifest to the device. */
export async function writeDeviceManifest(sftp: SFTPWrapper, manifest: RmMethodsManifest): Promise<void> {
  await writeRemoteFile(sftp, DEVICE_MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

/** Remove the deploy manifest from the device. */
export async function removeDeviceManifest(sftp: SFTPWrapper): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(DEVICE_MANIFEST_PATH, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}
