/**
 * Path traversal protection.
 */

import { sep } from 'node:path'

/**
 * Guard against path traversal attacks. Ensures a resolved path stays within
 * the expected base directory.
 * @param base - The allowed root directory (absolute path).
 * @param resolved - The fully resolved path to validate.
 * @throws If the resolved path escapes the base directory.
 */
export function assertWithin(base: string, resolved: string): void {
  if (!resolved.startsWith(base + sep) && resolved !== base) {
    throw new Error(`Path traversal attempt rejected: ${resolved}`)
  }
}
