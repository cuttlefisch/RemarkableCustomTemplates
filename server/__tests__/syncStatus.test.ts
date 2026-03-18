// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeSyncStatus } from '../lib/syncStatus.ts'
import type { RmMethodsManifest } from '../../src/lib/rmMethods.ts'

function makeManifest(entries: Record<string, { name: string; contentHash: string; templateVersion?: string }>): RmMethodsManifest {
  const templates: RmMethodsManifest['templates'] = {}
  for (const [uuid, e] of Object.entries(entries)) {
    templates[uuid] = {
      name: e.name,
      contentHash: e.contentHash,
      templateVersion: e.templateVersion ?? '1.0.0',
      createdTime: '1710672000000',
    }
  }
  return { exportedAt: '1710672000000', templates }
}

describe('computeSyncStatus', () => {
  it('returns empty results when both manifests are empty', () => {
    const local = makeManifest({})
    const result = computeSyncStatus(local, makeManifest({}))
    expect(result.summary).toEqual({ synced: 0, localOnly: 0, deviceOnly: 0, modified: 0, total: 0 })
    expect(result.templates).toEqual([])
  })

  it('marks all as local-only when device manifest is null', () => {
    const local = makeManifest({
      'uuid-1': { name: 'Alpha', contentHash: 'sha256:aaa' },
      'uuid-2': { name: 'Beta', contentHash: 'sha256:bbb' },
    })
    const result = computeSyncStatus(local, null)
    expect(result.summary).toEqual({ synced: 0, localOnly: 2, deviceOnly: 0, modified: 0, total: 2 })
    expect(result.templates).toHaveLength(2)
    expect(result.templates.every(t => t.state === 'local-only')).toBe(true)
  })

  it('marks all as device-only when local manifest is empty', () => {
    const local = makeManifest({})
    const device = makeManifest({
      'uuid-1': { name: 'Alpha', contentHash: 'sha256:aaa' },
      'uuid-2': { name: 'Beta', contentHash: 'sha256:bbb' },
    })
    const result = computeSyncStatus(local, device)
    expect(result.summary).toEqual({ synced: 0, localOnly: 0, deviceOnly: 2, modified: 0, total: 2 })
    expect(result.templates.every(t => t.state === 'device-only')).toBe(true)
  })

  it('marks as synced when same UUID has same contentHash', () => {
    const local = makeManifest({ 'uuid-1': { name: 'Grid', contentHash: 'sha256:abc' } })
    const device = makeManifest({ 'uuid-1': { name: 'Grid', contentHash: 'sha256:abc' } })
    const result = computeSyncStatus(local, device)
    expect(result.summary.synced).toBe(1)
    expect(result.templates[0].state).toBe('synced')
  })

  it('marks as modified when same UUID has different contentHash', () => {
    const local = makeManifest({ 'uuid-1': { name: 'Grid', contentHash: 'sha256:new', templateVersion: '1.0.1' } })
    const device = makeManifest({ 'uuid-1': { name: 'Grid', contentHash: 'sha256:old', templateVersion: '1.0.0' } })
    const result = computeSyncStatus(local, device)
    expect(result.summary.modified).toBe(1)
    const entry = result.templates[0]
    expect(entry.state).toBe('modified')
    expect(entry.localVersion).toBe('1.0.1')
    expect(entry.deviceVersion).toBe('1.0.0')
  })

  it('classifies a mix of all four states correctly', () => {
    const local = makeManifest({
      'uuid-synced': { name: 'Synced', contentHash: 'sha256:same' },
      'uuid-local': { name: 'Local Only', contentHash: 'sha256:loc' },
      'uuid-mod': { name: 'Modified', contentHash: 'sha256:new' },
    })
    const device = makeManifest({
      'uuid-synced': { name: 'Synced', contentHash: 'sha256:same' },
      'uuid-device': { name: 'Device Only', contentHash: 'sha256:dev' },
      'uuid-mod': { name: 'Modified', contentHash: 'sha256:old' },
    })
    const result = computeSyncStatus(local, device)
    expect(result.summary).toEqual({ synced: 1, localOnly: 1, deviceOnly: 1, modified: 1, total: 4 })

    const byUuid = Object.fromEntries(result.templates.map(t => [t.uuid, t]))
    expect(byUuid['uuid-synced'].state).toBe('synced')
    expect(byUuid['uuid-local'].state).toBe('local-only')
    expect(byUuid['uuid-device'].state).toBe('device-only')
    expect(byUuid['uuid-mod'].state).toBe('modified')
  })

  it('sorts templates by name', () => {
    const local = makeManifest({
      'uuid-c': { name: 'Charlie', contentHash: 'sha256:c' },
      'uuid-a': { name: 'Alpha', contentHash: 'sha256:a' },
      'uuid-b': { name: 'Bravo', contentHash: 'sha256:b' },
    })
    const result = computeSyncStatus(local, null)
    expect(result.templates.map(t => t.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('uses the other name when one manifest has no name', () => {
    const local = makeManifest({ 'uuid-1': { name: '', contentHash: 'sha256:aaa' } })
    const device = makeManifest({ 'uuid-1': { name: 'Device Name', contentHash: 'sha256:bbb' } })
    const result = computeSyncStatus(local, device)
    expect(result.templates[0].name).toBe('Device Name')
  })
})
