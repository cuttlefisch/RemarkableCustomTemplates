/**
 * Generate built-in notebook drafts from template registries.
 * These are virtual — generated on demand, never stored in notebooks.json.
 */

import { readFileSync, existsSync } from 'node:fs'
import type { NotebookDraft, PageGroup } from '../../src/types/notebook.ts'

interface RegistryEntry {
  name: string
  filename: string
  iconCode: string
  categories: string[]
  landscape?: boolean
  rmMethodsId?: string
  iconData?: string
}

/**
 * Generate a NotebookDraft from a template registry file.
 * Each registry entry becomes one page group (count=1).
 * Returns null if the registry is missing or empty.
 */
export function generateBuiltinNotebook(
  registryPath: string,
  id: string,
  name: string,
  source: 'sample' | 'debug',
): NotebookDraft | null {
  if (!existsSync(registryPath)) return null

  let registry: { templates: RegistryEntry[] }
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  } catch {
    return null
  }

  if (!registry.templates || registry.templates.length === 0) return null

  const pageGroups: PageGroup[] = registry.templates.map(entry => {
    const orientation = entry.landscape ? 'landscape' : 'portrait'
    const templateRef = entry.rmMethodsId
      ? `${entry.rmMethodsId}:${orientation}`
      : entry.filename

    return {
      id: `${id}-${entry.filename}`,
      templateRef,
      templateName: entry.name,
      count: 1,
      ...(entry.iconData ? { iconData: entry.iconData } : {}),
    }
  })

  return {
    id,
    name,
    pageGroups,
    deviceId: 'rm',
    orientation: 'portrait',
    lastModified: 0,
    source,
  }
}
