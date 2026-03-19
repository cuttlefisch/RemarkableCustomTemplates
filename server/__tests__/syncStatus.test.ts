// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeSyncStatus, computeClassicSyncStatus, addMethodsOverlay } from '../lib/syncStatus.ts'
import type { TemplateSyncEntry, SyncStatusSummary } from '../lib/syncStatus.ts'
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

describe('addMethodsOverlay', () => {
  function makeSummary(overrides?: Partial<SyncStatusSummary>): SyncStatusSummary {
    return { synced: 0, localOnly: 0, deviceOnly: 0, modified: 0, total: 0, ...overrides }
  }

  it('adds official-methods entries not already tracked', () => {
    const templates: TemplateSyncEntry[] = []
    const summary = makeSummary()
    addMethodsOverlay(templates, summary, [
      { rmMethodsId: 'uuid-1', name: 'Official Grid', origin: 'official-methods' },
    ])
    expect(templates).toHaveLength(1)
    expect(templates[0]).toEqual({ uuid: 'uuid-1', name: 'Official Grid', state: 'synced' })
    expect(summary.synced).toBe(1)
    expect(summary.total).toBe(1)
  })

  it('does NOT add custom-methods entries', () => {
    const templates: TemplateSyncEntry[] = []
    const summary = makeSummary()
    addMethodsOverlay(templates, summary, [
      { rmMethodsId: 'uuid-custom', name: 'Custom Grid', origin: 'custom-methods' },
    ])
    expect(templates).toHaveLength(0)
    expect(summary.synced).toBe(0)
    expect(summary.total).toBe(0)
  })

  it('does NOT add entries already in tracked set', () => {
    const templates: TemplateSyncEntry[] = [
      { uuid: 'uuid-1', name: 'Already Tracked', state: 'synced' },
    ]
    const summary = makeSummary({ synced: 1, total: 1 })
    addMethodsOverlay(templates, summary, [
      { rmMethodsId: 'uuid-1', name: 'Already Tracked', origin: 'official-methods' },
    ])
    expect(templates).toHaveLength(1)
    expect(summary.synced).toBe(1)
    expect(summary.total).toBe(1)
  })

  it('updates summary counts correctly with multiple entries', () => {
    const templates: TemplateSyncEntry[] = [
      { uuid: 'existing-1', name: 'Existing', state: 'local-only' },
    ]
    const summary = makeSummary({ localOnly: 1, total: 1 })
    addMethodsOverlay(templates, summary, [
      { rmMethodsId: 'new-1', name: 'New Official 1', origin: 'official-methods' },
      { rmMethodsId: 'new-2', name: 'New Official 2', origin: 'official-methods' },
      { rmMethodsId: 'custom-1', name: 'Custom Skip', origin: 'custom-methods' },
      { rmMethodsId: 'existing-1', name: 'Already There', origin: 'official-methods' },
    ])
    expect(templates).toHaveLength(3)
    expect(summary.synced).toBe(2)
    expect(summary.total).toBe(3)
    expect(summary.localOnly).toBe(1)
  })
})

describe('computeClassicSyncStatus', () => {
  const makeRegistry = (entries: { filename: string; name?: string }[]) => ({ templates: entries })

  it('returns empty results when both registries are empty', () => {
    const result = computeClassicSyncStatus(makeRegistry([]), makeRegistry([]))
    expect(result.summary).toEqual({ synced: 0, localOnly: 0, deviceOnly: 0, total: 0 })
    expect(result.templates).toEqual([])
  })

  it('marks matching filenames as synced', () => {
    const local = makeRegistry([{ filename: 'Grid', name: 'Grid' }])
    const device = makeRegistry([{ filename: 'Grid', name: 'Grid' }])
    const result = computeClassicSyncStatus(local, device)
    expect(result.summary.synced).toBe(1)
    expect(result.templates[0].state).toBe('synced')
  })

  it('marks local-only and device-only correctly', () => {
    const local = makeRegistry([{ filename: 'LocalOnly', name: 'Local' }])
    const device = makeRegistry([{ filename: 'DeviceOnly', name: 'Device' }])
    const result = computeClassicSyncStatus(local, device)
    expect(result.summary).toEqual({ synced: 0, localOnly: 1, deviceOnly: 1, total: 2 })
    const byFilename = Object.fromEntries(result.templates.map(t => [t.filename, t]))
    expect(byFilename['LocalOnly'].state).toBe('local-only')
    expect(byFilename['DeviceOnly'].state).toBe('device-only')
  })

  it('uses filename as fallback name when name is missing', () => {
    const local = makeRegistry([{ filename: 'MyTemplate' }])
    const result = computeClassicSyncStatus(local, makeRegistry([]))
    expect(result.templates[0].name).toBe('MyTemplate')
  })

  it('sorts templates by name', () => {
    const local = makeRegistry([
      { filename: 'c', name: 'Charlie' },
      { filename: 'a', name: 'Alpha' },
      { filename: 'b', name: 'Bravo' },
    ])
    const result = computeClassicSyncStatus(local, makeRegistry([]))
    expect(result.templates.map(t => t.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })
})
