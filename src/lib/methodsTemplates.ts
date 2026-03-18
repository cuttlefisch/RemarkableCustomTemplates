/**
 * Helpers for pulling and managing rm_methods templates from the device.
 */

import type { TemplateRegistryEntry } from '../types/registry'

/**
 * Build a registry entry from a pulled rm_methods UUID triplet.
 */
export function buildMethodsEntry(opts: {
  uuid: string
  visibleName: string
  orientation: 'portrait' | 'landscape'
  labels: string[]
  origin: 'official-methods' | 'custom-methods'
}): TemplateRegistryEntry {
  const categories = opts.labels.length > 0 ? opts.labels : ['Uncategorized']
  return {
    name: opts.visibleName,
    filename: `methods/${opts.uuid}`,
    iconCode: '\ue9d8',
    landscape: opts.orientation === 'landscape',
    categories,
    rmMethodsId: opts.uuid,
    origin: opts.origin,
  }
}

/**
 * Parse a .metadata file to extract visibleName.
 * Throws if the metadata is not a TemplateType.
 */
export function parseMethodsMetadata(raw: string): { visibleName: string; type: string } {
  const parsed = JSON.parse(raw) as Record<string, unknown>

  const type = parsed.type
  if (typeof type !== 'string' || type !== 'TemplateType') {
    throw new Error(`Metadata is not a TemplateType (got "${String(type)}")`)
  }

  const visibleName = parsed.visibleName
  if (typeof visibleName !== 'string') {
    throw new Error('Metadata missing visibleName')
  }

  return { visibleName, type }
}
