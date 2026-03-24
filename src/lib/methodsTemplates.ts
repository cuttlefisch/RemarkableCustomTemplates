/**
 * Helpers for pulling and managing rm_methods templates from the device.
 */

import type { TemplateRegistryEntry } from '../types/registry'

/**
 * Build a registry entry from a pulled rm_methods UUID triplet.
 *
 * @param opts - Template metadata extracted from the device
 * @param opts.uuid - The UUID identifying this methods template on-device
 * @param opts.visibleName - Human-readable name from the `.metadata` file
 * @param opts.orientation - Template orientation
 * @param opts.labels - Category labels (defaults to `['Uncategorized']` if empty)
 * @param opts.origin - Whether this is an official or custom methods template
 * @returns A registry entry suitable for `methods-registry.json`
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
 * Parse a `.metadata` file to extract the `visibleName`.
 *
 * @param raw - Raw JSON string from the `.metadata` file
 * @returns The visible name and type string
 * @throws If the metadata `type` is not `"TemplateType"` or `visibleName` is missing
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
