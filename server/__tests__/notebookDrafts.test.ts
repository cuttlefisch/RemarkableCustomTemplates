// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'
import type { NotebookDraft } from '../../src/types/notebook.ts'
import { readNotebookStore, writeNotebookStore } from '../lib/notebookDraftStore.ts'

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `nbdrafts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
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

describe('notebook draft API routes', () => {
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

  describe('GET /api/notebook-drafts', () => {
    it('returns empty list initially', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/notebook-drafts' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.drafts).toEqual([])
    })

    it('returns existing drafts', async () => {
      writeNotebookStore(config.notebookDraftsPath, {
        version: 1,
        drafts: [makeDraft({ id: 'a', name: 'A' }), makeDraft({ id: 'b', name: 'B' })],
      })

      const res = await app.inject({ method: 'GET', url: '/api/notebook-drafts' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.drafts).toHaveLength(2)
    })
  })

  describe('POST /api/notebook-drafts', () => {
    it('creates a single draft', async () => {
      const draft = makeDraft({ id: 'new-1', name: 'New One' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebook-drafts',
        payload: draft,
        headers: { 'content-type': 'application/json' },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.draft.id).toBe('new-1')
      expect(body.draft.name).toBe('New One')

      // Verify persisted
      const store = readNotebookStore(config.notebookDraftsPath)
      expect(store.drafts).toHaveLength(1)
    })

    it('batch-creates multiple drafts for migration', async () => {
      const drafts = [
        makeDraft({ id: 'batch-1', name: 'Batch 1' }),
        makeDraft({ id: 'batch-2', name: 'Batch 2' }),
      ]
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebook-drafts',
        payload: { drafts },
        headers: { 'content-type': 'application/json' },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.imported).toBe(2)

      const store = readNotebookStore(config.notebookDraftsPath)
      expect(store.drafts).toHaveLength(2)
    })

    it('rejects POST with missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebook-drafts',
        payload: { name: 'No ID or other fields' },
        headers: { 'content-type': 'application/json' },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('PUT /api/notebook-drafts/:id', () => {
    it('updates an existing draft', async () => {
      writeNotebookStore(config.notebookDraftsPath, {
        version: 1,
        drafts: [makeDraft({ id: 'upd-1', name: 'Old' })],
      })

      const res = await app.inject({
        method: 'PUT',
        url: '/api/notebook-drafts/upd-1',
        payload: makeDraft({ id: 'upd-1', name: 'Updated' }),
        headers: { 'content-type': 'application/json' },
      })

      expect(res.statusCode).toBe(200)
      const store = readNotebookStore(config.notebookDraftsPath)
      expect(store.drafts[0].name).toBe('Updated')
    })

    it('returns 404 for non-existent draft', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/notebook-drafts/nope',
        payload: makeDraft({ id: 'nope' }),
        headers: { 'content-type': 'application/json' },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/notebook-drafts/:id', () => {
    it('deletes an existing draft', async () => {
      writeNotebookStore(config.notebookDraftsPath, {
        version: 1,
        drafts: [makeDraft({ id: 'del-1' }), makeDraft({ id: 'del-2' })],
      })

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/notebook-drafts/del-1',
      })

      expect(res.statusCode).toBe(200)
      const store = readNotebookStore(config.notebookDraftsPath)
      expect(store.drafts).toHaveLength(1)
      expect(store.drafts[0].id).toBe('del-2')
    })

    it('returns 404 for non-existent draft', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/notebook-drafts/nope',
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/notebook-drafts (clear all)', () => {
    it('deletes all drafts', async () => {
      writeNotebookStore(config.notebookDraftsPath, {
        version: 1,
        drafts: [makeDraft(), makeDraft(), makeDraft()],
      })

      const res = await app.inject({ method: 'DELETE', url: '/api/notebook-drafts' })
      expect(res.statusCode).toBe(200)

      const store = readNotebookStore(config.notebookDraftsPath)
      expect(store.drafts).toHaveLength(0)
    })

    it('succeeds even when no drafts exist', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/notebook-drafts' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ ok: true })
    })
  })

  describe('POST /api/notebook-drafts/:id/fork', () => {
    it('duplicates a draft with new IDs', async () => {
      writeNotebookStore(config.notebookDraftsPath, {
        version: 1,
        drafts: [makeDraft({
          id: 'fork-src',
          name: 'Original',
          pageGroups: [{ id: 'pg-1', templateRef: 'Blank', templateName: 'Blank', count: 2 }],
        })],
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/notebook-drafts/fork-src/fork',
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.draft.name).toBe('Original (Copy)')
      expect(body.draft.id).not.toBe('fork-src')
      expect(body.draft.pageGroups[0].id).not.toBe('pg-1')

      const store = readNotebookStore(config.notebookDraftsPath)
      expect(store.drafts).toHaveLength(2)
    })

    it('returns 404 for non-existent source', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebook-drafts/nope/fork',
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
