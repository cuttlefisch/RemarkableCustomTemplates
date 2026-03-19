/**
 * Compare local build manifest against device manifest to determine sync status.
 * Pure function — no SSH or filesystem access.
 */

import type { RmMethodsManifest } from '../../src/lib/rmMethods.ts'

export type SyncState = 'synced' | 'local-only' | 'device-only' | 'modified'

export interface TemplateSyncEntry {
  uuid: string
  name: string
  state: SyncState
  localVersion?: string
  deviceVersion?: string
}

export interface SyncStatusSummary {
  synced: number
  localOnly: number
  deviceOnly: number
  modified: number
  total: number
}

export function computeSyncStatus(
  localManifest: RmMethodsManifest,
  deviceManifest: RmMethodsManifest | null,
): { summary: SyncStatusSummary; templates: TemplateSyncEntry[] } {
  const localTemplates = localManifest.templates
  const deviceTemplates = deviceManifest?.templates ?? {}

  const allUuids = new Set([...Object.keys(localTemplates), ...Object.keys(deviceTemplates)])

  const templates: TemplateSyncEntry[] = []

  for (const uuid of allUuids) {
    const local = localTemplates[uuid]
    const device = deviceTemplates[uuid]

    let state: SyncState
    if (local && !device) {
      state = 'local-only'
    } else if (!local && device) {
      state = 'device-only'
    } else if (local && device && local.contentHash === device.contentHash) {
      state = 'synced'
    } else {
      state = 'modified'
    }

    const name = (local?.name || device?.name) ?? uuid

    templates.push({
      uuid,
      name,
      state,
      localVersion: local?.templateVersion,
      deviceVersion: device?.templateVersion,
    })
  }

  templates.sort((a, b) => a.name.localeCompare(b.name))

  const summary: SyncStatusSummary = {
    synced: templates.filter(t => t.state === 'synced').length,
    localOnly: templates.filter(t => t.state === 'local-only').length,
    deviceOnly: templates.filter(t => t.state === 'device-only').length,
    modified: templates.filter(t => t.state === 'modified').length,
    total: templates.length,
  }

  return { summary, templates }
}

// ---------------------------------------------------------------------------
// Methods registry overlay — add official-methods entries not already tracked
// ---------------------------------------------------------------------------

/**
 * After computing sync status from manifests, overlay pulled methods entries
 * that aren't tracked in either manifest. Only adds official-methods entries;
 * custom-methods entries are already in the local build via importCustomMethods.
 */
export function addMethodsOverlay(
  templates: TemplateSyncEntry[],
  summary: SyncStatusSummary,
  methodsEntries: { rmMethodsId?: string; name: string; origin?: string }[],
): void {
  const trackedUuids = new Set(templates.map(t => t.uuid))
  for (const entry of methodsEntries) {
    if (entry.rmMethodsId && !trackedUuids.has(entry.rmMethodsId) && entry.origin === 'official-methods') {
      templates.push({ uuid: entry.rmMethodsId, name: entry.name, state: 'device-only' })
      summary.deviceOnly++
      summary.total++
    }
  }
}

// ---------------------------------------------------------------------------
// Classic sync status (filename-based comparison, no content hashing)
// ---------------------------------------------------------------------------

export type ClassicSyncState = 'synced' | 'local-only' | 'device-only'

export interface ClassicSyncEntry {
  filename: string
  name: string
  state: ClassicSyncState
}

export interface ClassicSyncResult {
  summary: { synced: number; localOnly: number; deviceOnly: number; total: number }
  templates: ClassicSyncEntry[]
}

export function computeClassicSyncStatus(
  localRegistry: { templates: { filename: string; name?: string }[] },
  deviceRegistry: { templates: { filename: string; name?: string }[] },
): ClassicSyncResult {
  const localByFilename = new Map(localRegistry.templates.map(t => [t.filename, t.name ?? t.filename]))
  const deviceByFilename = new Map(deviceRegistry.templates.map(t => [t.filename, t.name ?? t.filename]))

  const allFilenames = new Set([...localByFilename.keys(), ...deviceByFilename.keys()])
  const templates: ClassicSyncEntry[] = []

  for (const filename of allFilenames) {
    const inLocal = localByFilename.has(filename)
    const inDevice = deviceByFilename.has(filename)

    let state: ClassicSyncState
    if (inLocal && inDevice) {
      state = 'synced'
    } else if (inLocal) {
      state = 'local-only'
    } else {
      state = 'device-only'
    }

    const name = localByFilename.get(filename) ?? deviceByFilename.get(filename) ?? filename
    templates.push({ filename, name, state })
  }

  templates.sort((a, b) => a.name.localeCompare(b.name))

  return {
    summary: {
      synced: templates.filter(t => t.state === 'synced').length,
      localOnly: templates.filter(t => t.state === 'local-only').length,
      deviceOnly: templates.filter(t => t.state === 'device-only').length,
      total: templates.length,
    },
    templates,
  }
}
