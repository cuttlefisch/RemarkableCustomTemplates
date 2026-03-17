/**
 * Pure validation and merge functions for template backup/restore.
 */

import { parseRegistry } from './registry'
import { parseTemplate } from './parser'
import type { TemplateRegistry, TemplateRegistryEntry } from '../types/registry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackupManifest {
  version: 1
  createdAt: string // ISO 8601
  templateCount: { custom: number; debug: number }
}

export interface BackupValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  manifest: BackupManifest | null
  customRegistry: TemplateRegistry | null
  debugRegistry: TemplateRegistry | null
  customTemplateFiles: string[]
  debugTemplateFiles: string[]
}

export interface MergeAction {
  entry: TemplateRegistryEntry
  action: 'add' | 'skip'
  reason?: string
}

// ---------------------------------------------------------------------------
// buildBackupManifest
// ---------------------------------------------------------------------------

export function buildBackupManifest(customCount: number, debugCount: number): BackupManifest {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    templateCount: { custom: customCount, debug: debugCount },
  }
}

// ---------------------------------------------------------------------------
// validateBackupContents
// ---------------------------------------------------------------------------

export function validateBackupContents(files: Record<string, Uint8Array>): BackupValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let manifest: BackupManifest | null = null
  let customRegistry: TemplateRegistry | null = null
  let debugRegistry: TemplateRegistry | null = null
  const customTemplateFiles: string[] = []
  const debugTemplateFiles: string[] = []

  // 1. Check manifest
  const manifestData = files['backup-manifest.json']
  if (!manifestData) {
    errors.push('Missing backup-manifest.json')
    return { valid: false, errors, warnings, manifest, customRegistry, debugRegistry, customTemplateFiles, debugTemplateFiles }
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(manifestData)) as Record<string, unknown>
    if (parsed.version !== 1) {
      errors.push(`Unsupported backup version: ${String(parsed.version)} (expected 1)`)
      return { valid: false, errors, warnings, manifest, customRegistry, debugRegistry, customTemplateFiles, debugTemplateFiles }
    }
    manifest = parsed as unknown as BackupManifest
  } catch (e) {
    errors.push(`Invalid manifest JSON: ${String(e)}`)
    return { valid: false, errors, warnings, manifest, customRegistry, debugRegistry, customTemplateFiles, debugTemplateFiles }
  }

  // 2. Parse registries
  const customRegData = files['custom/custom-registry.json']
  const debugRegData = files['debug/debug-registry.json']

  if (customRegData) {
    try {
      const raw = JSON.parse(new TextDecoder().decode(customRegData))
      customRegistry = parseRegistry(raw)
    } catch (e) {
      errors.push(`Invalid custom registry: ${String(e)}`)
    }
  }

  if (debugRegData) {
    try {
      const raw = JSON.parse(new TextDecoder().decode(debugRegData))
      debugRegistry = parseRegistry(raw)
    } catch (e) {
      errors.push(`Invalid debug registry: ${String(e)}`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, manifest, customRegistry, debugRegistry, customTemplateFiles, debugTemplateFiles }
  }

  // 3. Collect template files from the ZIP
  const customFileSet = new Set<string>()
  const debugFileSet = new Set<string>()

  for (const path of Object.keys(files)) {
    if (path.startsWith('custom/') && path.endsWith('.template')) {
      customTemplateFiles.push(path)
      customFileSet.add(path)
    }
    if (path.startsWith('debug/') && path.endsWith('.template')) {
      debugTemplateFiles.push(path)
      debugFileSet.add(path)
    }
  }

  // 4. Cross-check registry entries against template files
  const allEntries = [
    ...(customRegistry?.templates ?? []).map(e => ({ entry: e, prefix: 'custom' })),
    ...(debugRegistry?.templates ?? []).map(e => ({ entry: e, prefix: 'debug' })),
  ]

  for (const { entry, prefix } of allEntries) {
    const shortName = entry.filename.replace(new RegExp(`^${prefix}/`), '')
    const expectedPath = `${prefix}/${shortName}.template`

    if (!files[expectedPath]) {
      warnings.push(`Registry entry "${entry.name}" references missing file: ${expectedPath}`)
    }

    if (!entry.rmMethodsId) {
      warnings.push(`Entry "${entry.name}" is missing rmMethodsId — device sync may not work`)
    }
  }

  // 5. Check for orphan template files
  const registeredCustomFiles = new Set(
    (customRegistry?.templates ?? []).map(e => `custom/${e.filename.replace(/^custom\//, '')}.template`),
  )
  const registeredDebugFiles = new Set(
    (debugRegistry?.templates ?? []).map(e => `debug/${e.filename.replace(/^debug\//, '')}.template`),
  )

  for (const f of customFileSet) {
    if (!registeredCustomFiles.has(f)) {
      warnings.push(`Orphan template file not in registry: ${f}`)
    }
  }
  for (const f of debugFileSet) {
    if (!registeredDebugFiles.has(f)) {
      warnings.push(`Orphan template file not in registry: ${f}`)
    }
  }

  // 6. Validate template files parse correctly
  for (const path of [...customTemplateFiles, ...debugTemplateFiles]) {
    try {
      const raw = JSON.parse(new TextDecoder().decode(files[path]))
      parseTemplate(raw)
    } catch (e) {
      errors.push(`Invalid template ${path}: ${String(e)}`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, manifest, customRegistry, debugRegistry, customTemplateFiles, debugTemplateFiles }
  }

  // 7. Check for completely empty backup
  const totalEntries = (customRegistry?.templates.length ?? 0) + (debugRegistry?.templates.length ?? 0)
  const totalFiles = customTemplateFiles.length + debugTemplateFiles.length
  if (totalEntries === 0 && totalFiles === 0) {
    errors.push('Backup is empty — no custom or debug templates found')
    return { valid: false, errors, warnings, manifest, customRegistry, debugRegistry, customTemplateFiles, debugTemplateFiles }
  }

  return { valid: true, errors, warnings, manifest, customRegistry, debugRegistry, customTemplateFiles, debugTemplateFiles }
}

// ---------------------------------------------------------------------------
// computeMergeActions
// ---------------------------------------------------------------------------

export function computeMergeActions(
  incoming: TemplateRegistryEntry[],
  existing: TemplateRegistryEntry[],
): MergeAction[] {
  const existingByUuid = new Map<string, TemplateRegistryEntry>()
  const existingByFilename = new Map<string, TemplateRegistryEntry>()

  for (const e of existing) {
    if (e.rmMethodsId) existingByUuid.set(e.rmMethodsId, e)
    existingByFilename.set(e.filename, e)
  }

  return incoming.map(entry => {
    if (entry.rmMethodsId && existingByUuid.has(entry.rmMethodsId)) {
      return { entry, action: 'skip' as const, reason: 'UUID match' }
    }
    if (existingByFilename.has(entry.filename)) {
      return { entry, action: 'skip' as const, reason: 'filename match' }
    }
    return { entry, action: 'add' as const }
  })
}
