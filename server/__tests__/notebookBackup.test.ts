// @vitest-environment node
/**
 * Tests for notebook draft inclusion in backup/restore.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { unzipSync, strFromU8 } from 'fflate'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'
import { writeNotebookStore, readNotebookStore } from '../lib/notebookDraftStore.ts'
import type { NotebookDraft } from '../../src/types/notebook.ts'

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `nbbackup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(base, 'public/templates/custom'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/debug'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/methods'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/samples'), { recursive: true })
  mkdirSync(resolve(base, 'remarkable_official_templates'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-dist'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-backups'), { recursive: true })
  mkdirSync(resolve(base, 'data/ssh'), { recursive: true })
  mkdirSync(resolve(base, 'notebook-dist'), { recursive: true })
  return resolveConfig({ dataDir: base, port: 0, production: false })
}

function makeDraft(overrides?: Partial<NotebookDraft>): NotebookDraft {
  return {
    id: overrides?.id ?? `draft-${Math.random().toString(36).slice(2)}`,
    name: overrides?.name ?? 'Test Notebook',
    pageGroups: overrides?.pageGroups ?? [],
    deviceId: overrides?.deviceId ?? 'rm',
    orientation: overrides?.orientation ?? 'portrait',
    lastModified: overrides?.lastModified ?? Date.now(),
    ...overrides,
  }
}

describe('notebook backup/restore integration', () => {
  let config: ServerConfig
  let app: Awaited<ReturnType<typeof createApp>>

  beforeEach(async () => {
    config = makeConfig()
    app = await createApp(config)
  })

  afterEach(async () => {
    await app.close()
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  it('backup includes notebooks when drafts exist', async () => {
    writeNotebookStore(config.notebookDraftsPath, {
      version: 1,
      drafts: [
        makeDraft({ id: 'nb-1', name: 'Notebook A' }),
        makeDraft({ id: 'nb-2', name: 'Notebook B' }),
      ],
    })

    const res = await app.inject({ method: 'GET', url: '/api/backup' })
    expect(res.statusCode).toBe(200)

    const zip = unzipSync(new Uint8Array(res.rawPayload))
    expect(zip['notebooks/notebooks.json']).toBeDefined()

    const nbData = JSON.parse(strFromU8(zip['notebooks/notebooks.json']))
    expect(nbData.version).toBe(1)
    expect(nbData.drafts).toHaveLength(2)

    // Manifest should include notebook count
    const manifest = JSON.parse(strFromU8(zip['backup-manifest.json']))
    expect(manifest.notebookCount).toBe(2)
  })

  it('backup without notebooks is still valid', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/backup' })
    expect(res.statusCode).toBe(200)

    const zip = unzipSync(new Uint8Array(res.rawPayload))
    // notebooks.json may not be present if no drafts exist
    expect(zip['backup-manifest.json']).toBeDefined()
  })

  it('restore merge adds new notebooks, skips existing by id', async () => {
    // Pre-existing notebook on server
    writeNotebookStore(config.notebookDraftsPath, {
      version: 1,
      drafts: [makeDraft({ id: 'existing-1', name: 'Existing' })],
    })

    // Create a backup ZIP with existing-1 (should skip) and new-1 (should add)
    const backupRes = await app.inject({ method: 'GET', url: '/api/backup' })
    const backupZip = unzipSync(new Uint8Array(backupRes.rawPayload))

    // Modify the notebooks.json in the backup to include both
    const nbStore = {
      version: 1,
      drafts: [
        makeDraft({ id: 'existing-1', name: 'Existing (from backup)' }),
        makeDraft({ id: 'new-1', name: 'New from backup' }),
      ],
    }
    backupZip['notebooks/notebooks.json'] = new TextEncoder().encode(JSON.stringify(nbStore))

    // Re-zip
    const { zipSync } = await import('fflate')
    const rezipped = zipSync(backupZip)

    const restoreRes = await app.inject({
      method: 'POST',
      url: '/api/restore?mode=merge',
      headers: { 'content-type': 'application/zip' },
      payload: Buffer.from(rezipped),
    })

    expect(restoreRes.statusCode).toBe(200)
    const body = JSON.parse(restoreRes.body)
    expect(body.notebooksAdded).toBe(1)
    expect(body.notebooksSkipped).toBe(1)

    // Server should have both
    const store = readNotebookStore(config.notebookDraftsPath)
    expect(store.drafts).toHaveLength(2)
    // The existing one should keep its original name (not overwritten)
    expect(store.drafts.find(d => d.id === 'existing-1')!.name).toBe('Existing')
  })

  it('restore replace overwrites all notebooks', async () => {
    writeNotebookStore(config.notebookDraftsPath, {
      version: 1,
      drafts: [makeDraft({ id: 'old-1', name: 'Old' })],
    })

    // Create a backup with different notebooks
    const backupRes = await app.inject({ method: 'GET', url: '/api/backup' })
    const backupZip = unzipSync(new Uint8Array(backupRes.rawPayload))

    const nbStore = {
      version: 1,
      drafts: [makeDraft({ id: 'replaced-1', name: 'Replaced' })],
    }
    backupZip['notebooks/notebooks.json'] = new TextEncoder().encode(JSON.stringify(nbStore))

    const { zipSync } = await import('fflate')
    const rezipped = zipSync(backupZip)

    const restoreRes = await app.inject({
      method: 'POST',
      url: '/api/restore?mode=replace',
      headers: { 'content-type': 'application/zip' },
      payload: Buffer.from(rezipped),
    })

    expect(restoreRes.statusCode).toBe(200)

    const store = readNotebookStore(config.notebookDraftsPath)
    expect(store.drafts).toHaveLength(1)
    expect(store.drafts[0].id).toBe('replaced-1')
  })

  it('old backup without notebooks restores cleanly', async () => {
    // Seed a custom template so the backup isn't empty
    const { writeFileSync: wfs } = await import('node:fs')
    const { resolve: rs } = await import('node:path')
    wfs(config.customRegistry, JSON.stringify({ templates: [{ name: 'Seed', filename: 'custom/P Seed', iconCode: 'e9fe', landscape: false, categories: ['Custom'] }] }), 'utf8')
    wfs(rs(config.customDir, 'P Seed.template'), JSON.stringify({ name: 'Seed', author: 'test', templateVersion: '1.0.0', formatVersion: 1, categories: ['Custom'], orientation: 'portrait', constants: [], items: [] }), 'utf8')

    // Create a backup (has templates but no notebooks)
    const backupRes = await app.inject({ method: 'GET', url: '/api/backup' })

    // Add some notebooks to server after backup was taken
    writeNotebookStore(config.notebookDraftsPath, {
      version: 1,
      drafts: [makeDraft({ id: 'existing', name: 'Existing' })],
    })

    // Restore old backup (merge mode) — notebooks should be untouched
    const restoreRes = await app.inject({
      method: 'POST',
      url: '/api/restore?mode=merge',
      headers: { 'content-type': 'application/zip' },
      payload: backupRes.rawPayload,
    })

    expect(restoreRes.statusCode).toBe(200)

    const store = readNotebookStore(config.notebookDraftsPath)
    expect(store.drafts).toHaveLength(1)
    expect(store.drafts[0].name).toBe('Existing')
  })
})
