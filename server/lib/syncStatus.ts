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
