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

/** Filename of the deploy manifest stored on the device. */
export const DEVICE_MANIFEST_FILENAME = '.remarkable-templates-deployed'

/** Absolute path to the xochitl data directory where rm_methods templates live. */
export const RM_METHODS_PATH = '/home/root/.local/share/remarkable/xochitl'

/** Full absolute path to the deploy manifest file on the device. */
export const DEVICE_MANIFEST_PATH = `${RM_METHODS_PATH}/${DEVICE_MANIFEST_FILENAME}`

// ---------------------------------------------------------------------------
// Pure functions (testable without SSH)
// ---------------------------------------------------------------------------

/**
 * Extract sorted template UUIDs from a manifest JSON string.
 * @param json - Raw JSON string of an {@link RmMethodsManifest}.
 * @returns Sorted array of UUID strings, or empty array on invalid/missing input.
 */
export function parseManifestUuids(json: string): string[] {
  if (!json) return []
  try {
    const m = JSON.parse(json) as { templates?: Record<string, unknown> }
    return Object.keys(m.templates ?? {}).sort()
  } catch {
    return []
  }
}

/**
 * Merge two UUID arrays into a sorted, deduplicated union.
 * Used to combine local and device-side manifest UUIDs during deploy.
 * @param localUuids - UUIDs from the local build manifest.
 * @param deviceUuids - UUIDs from the device deploy manifest.
 * @returns Sorted, deduplicated array of all UUIDs.
 */
export function mergeDeployedUuids(localUuids: string[], deviceUuids: string[]): string[] {
  return [...new Set([...localUuids, ...deviceUuids])].sort()
}

// ---------------------------------------------------------------------------
// SFTP functions
// ---------------------------------------------------------------------------

/**
 * Read the deploy manifest from the device via SFTP.
 * @param sftp - An active SFTP session.
 * @returns The parsed manifest, or null if the file doesn't exist or is invalid.
 */
export async function readDeviceManifest(sftp: SFTPWrapper): Promise<RmMethodsManifest | null> {
  try {
    const content = await readRemoteFile(sftp, DEVICE_MANIFEST_PATH)
    return JSON.parse(content) as RmMethodsManifest
  } catch {
    return null
  }
}

/**
 * Write the deploy manifest to the device via SFTP.
 * @param sftp - An active SFTP session.
 * @param manifest - The manifest to serialize and write.
 */
export async function writeDeviceManifest(sftp: SFTPWrapper, manifest: RmMethodsManifest): Promise<void> {
  await writeRemoteFile(sftp, DEVICE_MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

/**
 * Delete the deploy manifest file from the device.
 * @param sftp - An active SFTP session.
 * @throws If the file cannot be deleted (e.g. permission error).
 */
export async function removeDeviceManifest(sftp: SFTPWrapper): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(DEVICE_MANIFEST_PATH, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}
