/// <reference types="node" />
/**
 * Helpers for rm_methods export: content hashing, version bumping,
 * metadata generation, and manifest types.
 */

import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManifestEntry {
  name: string
  templateVersion: string
  contentHash: string
  createdTime: string // Unix ms string
}

export interface RmMethodsManifest {
  exportedAt: string // Unix ms string
  templates: Record<string, ManifestEntry> // keyed by UUID
}

// ---------------------------------------------------------------------------
// Content hashing
// ---------------------------------------------------------------------------

/** Fields excluded from the content hash (volatile / generated). */
const HASH_EXCLUDED_KEYS = new Set(['templateVersion', 'iconData'])

/**
 * Produce a deterministic SHA-256 hash of the template's semantic content.
 * Excludes `templateVersion` and `iconData` so that regenerating icons or
 * bumping versions doesn't change the hash.
 */
export function templateContentHash(tplObj: Record<string, unknown>): string {
  const filtered: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(tplObj)) {
    if (!HASH_EXCLUDED_KEYS.has(k)) {
      filtered[k] = v
    }
  }
  const json = JSON.stringify(filtered)
  const digest = createHash('sha256').update(json).digest('hex')
  return `sha256:${digest}`
}

// ---------------------------------------------------------------------------
// Version bumping
// ---------------------------------------------------------------------------

/**
 * Increment the patch segment of a semver-style version string.
 * `"1.0.0"` → `"1.0.1"`, `"1.0.9"` → `"1.0.10"`
 */
export function bumpPatchVersion(version: string): string {
  const parts = version.split('.')
  const last = Number(parts[parts.length - 1])
  parts[parts.length - 1] = String(last + 1)
  return parts.join('.')
}

/**
 * Decide the correct templateVersion for a template being exported.
 *
 * - No previous entry → use `sourceVersion` as-is.
 * - Same content hash → keep previous version (no change).
 * - Different content hash → bump the previous version's patch segment.
 */
export function resolveTemplateVersion(opts: {
  prevEntry?: ManifestEntry
  currentHash: string
  sourceVersion: string
}): string {
  const { prevEntry, currentHash, sourceVersion } = opts
  if (!prevEntry) return sourceVersion
  if (prevEntry.contentHash === currentHash) return prevEntry.templateVersion
  return bumpPatchVersion(prevEntry.templateVersion)
}

// ---------------------------------------------------------------------------
// Metadata builder
// ---------------------------------------------------------------------------

/**
 * Build a `.metadata` object matching the official xochitl TemplateType format.
 *
 * Timestamps are Unix-millisecond strings (e.g. `"1710672000000"`).
 * `createdTime` is preserved across exports when provided; otherwise set to `nowMs`.
 */
export function buildRmMethodsMetadata(opts: {
  visibleName: string
  createdTime?: string // preserved from previous manifest
  nowMs: string
}): Record<string, unknown> {
  return {
    createdTime: opts.createdTime ?? opts.nowMs,
    lastModified: opts.nowMs,
    new: false,
    parent: '',
    pinned: false,
    source: 'com.remarkable.methods',
    type: 'TemplateType',
    visibleName: opts.visibleName,
  }
}
