/**
 * Path traversal protection.
 */

import { sep } from 'node:path'

/** Throws if `resolved` is not within `base` directory. */
export function assertWithin(base: string, resolved: string): void {
  if (!resolved.startsWith(base + sep) && resolved !== base) {
    throw new Error(`Path traversal attempt rejected: ${resolved}`)
  }
}
