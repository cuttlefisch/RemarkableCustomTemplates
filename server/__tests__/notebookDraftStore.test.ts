// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import type { NotebookDraft } from '../../src/types/notebook.ts'
import {
  readNotebookStore,
  writeNotebookStore,
  upsertDraft,
  removeDraft,
  forkDraft,
  type NotebookDraftStore,
} from '../lib/notebookDraftStore.ts'

function makeTmpDir(): string {
  const dir = resolve(tmpdir(), `nbstore-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(dir, 'data'), { recursive: true })
  return dir
}

function storePath(base: string): string {
  return resolve(base, 'data/notebooks.json')
}

function makeDraft(overrides?: Partial<NotebookDraft>): NotebookDraft {
  return {
    id: overrides?.id ?? 'draft-1',
    name: overrides?.name ?? 'Test Notebook',
    pageGroups: overrides?.pageGroups ?? [],
    deviceId: overrides?.deviceId ?? 'rm',
    orientation: overrides?.orientation ?? 'portrait',
    lastModified: overrides?.lastModified ?? 1000,
    ...overrides,
  }
}

describe('notebookDraftStore', () => {
  let base: string

  beforeEach(() => {
    base = makeTmpDir()
  })

  afterEach(() => {
    rmSync(base, { recursive: true, force: true })
  })

  describe('readNotebookStore', () => {
    it('returns empty store when file does not exist', () => {
      const store = readNotebookStore(storePath(base))
      expect(store).toEqual({ version: 1, drafts: [] })
    })

    it('reads a v1 store as-is', () => {
      const existing: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft()],
      }
      writeFileSync(storePath(base), JSON.stringify(existing))

      const store = readNotebookStore(storePath(base))
      expect(store.version).toBe(1)
      expect(store.drafts).toHaveLength(1)
      expect(store.drafts[0].name).toBe('Test Notebook')
    })

    it('returns empty store for invalid JSON', () => {
      writeFileSync(storePath(base), 'not valid json!!!')
      const store = readNotebookStore(storePath(base))
      expect(store).toEqual({ version: 1, drafts: [] })
    })

    it('returns empty store for JSON without drafts array', () => {
      writeFileSync(storePath(base), JSON.stringify({ version: 1, drafts: 'not-an-array' }))
      const store = readNotebookStore(storePath(base))
      expect(store).toEqual({ version: 1, drafts: [] })
    })

    it('normalizes :portrait to :p in template refs on read', () => {
      const existing: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft({
          id: 'legacy-1',
          pageGroups: [
            { id: 'pg-1', templateRef: 'a1b2c3d4-0001-4000-8000-000000000001:portrait', templateName: 'Grid', count: 1 },
            { id: 'pg-2', templateRef: 'a1b2c3d4-0004-4000-8000-000000000004:landscape', templateName: 'Wide', count: 1 },
          ],
        })],
      }
      writeFileSync(storePath(base), JSON.stringify(existing))

      const store = readNotebookStore(storePath(base))
      expect(store.drafts[0].pageGroups[0].templateRef).toBe('a1b2c3d4-0001-4000-8000-000000000001:p')
      expect(store.drafts[0].pageGroups[1].templateRef).toBe('a1b2c3d4-0004-4000-8000-000000000004:l')
    })

    it('leaves :p and :l template refs unchanged on read', () => {
      const existing: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft({
          id: 'ok-1',
          pageGroups: [
            { id: 'pg-1', templateRef: 'abc-123:p', templateName: 'Grid', count: 1 },
            { id: 'pg-2', templateRef: 'def-456:l', templateName: 'Wide', count: 1 },
          ],
        })],
      }
      writeFileSync(storePath(base), JSON.stringify(existing))

      const store = readNotebookStore(storePath(base))
      expect(store.drafts[0].pageGroups[0].templateRef).toBe('abc-123:p')
      expect(store.drafts[0].pageGroups[1].templateRef).toBe('def-456:l')
    })
  })

  describe('writeNotebookStore', () => {
    it('creates parent directories and writes JSON', () => {
      const deepPath = resolve(base, 'deep/nested/notebooks.json')
      const store: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft()],
      }
      writeNotebookStore(deepPath, store)

      const onDisk = JSON.parse(readFileSync(deepPath, 'utf8'))
      expect(onDisk.version).toBe(1)
      expect(onDisk.drafts).toHaveLength(1)
    })
  })

  describe('upsertDraft', () => {
    it('inserts a new draft into empty store', () => {
      const draft = makeDraft({ id: 'new-1' })
      upsertDraft(storePath(base), draft)

      const store = readNotebookStore(storePath(base))
      expect(store.drafts).toHaveLength(1)
      expect(store.drafts[0].id).toBe('new-1')
    })

    it('updates an existing draft by id', () => {
      const store: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft({ id: 'upd-1', name: 'Old Name' })],
      }
      writeFileSync(storePath(base), JSON.stringify(store))

      upsertDraft(storePath(base), makeDraft({ id: 'upd-1', name: 'New Name' }))

      const result = readNotebookStore(storePath(base))
      expect(result.drafts).toHaveLength(1)
      expect(result.drafts[0].name).toBe('New Name')
    })

    it('preserves other drafts when updating', () => {
      const store: NotebookDraftStore = {
        version: 1,
        drafts: [
          makeDraft({ id: 'a', name: 'A' }),
          makeDraft({ id: 'b', name: 'B' }),
        ],
      }
      writeFileSync(storePath(base), JSON.stringify(store))

      upsertDraft(storePath(base), makeDraft({ id: 'a', name: 'A Updated' }))

      const result = readNotebookStore(storePath(base))
      expect(result.drafts).toHaveLength(2)
      expect(result.drafts.find(d => d.id === 'a')!.name).toBe('A Updated')
      expect(result.drafts.find(d => d.id === 'b')!.name).toBe('B')
    })
  })

  describe('removeDraft', () => {
    it('removes a draft by id', () => {
      const store: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft({ id: 'rm-1' }), makeDraft({ id: 'rm-2' })],
      }
      writeFileSync(storePath(base), JSON.stringify(store))

      removeDraft(storePath(base), 'rm-1')

      const result = readNotebookStore(storePath(base))
      expect(result.drafts).toHaveLength(1)
      expect(result.drafts[0].id).toBe('rm-2')
    })

    it('is a no-op for non-existent id', () => {
      const store: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft({ id: 'keep-1' })],
      }
      writeFileSync(storePath(base), JSON.stringify(store))

      removeDraft(storePath(base), 'nope')

      const result = readNotebookStore(storePath(base))
      expect(result.drafts).toHaveLength(1)
    })
  })

  describe('forkDraft', () => {
    it('creates a copy with new id and "(Copy)" name', () => {
      const store: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft({ id: 'src-1', name: 'My Notebook', pageGroups: [
          { id: 'pg-1', templateRef: 'Blank', templateName: 'Blank', count: 3 },
        ] })],
      }
      writeFileSync(storePath(base), JSON.stringify(store))

      const forked = forkDraft(storePath(base), 'src-1')

      expect(forked).not.toBeNull()
      expect(forked!.id).not.toBe('src-1')
      expect(forked!.name).toBe('My Notebook (Copy)')
      expect(forked!.pageGroups).toHaveLength(1)
      expect(forked!.pageGroups[0].id).not.toBe('pg-1') // new UUID for page group
      expect(forked!.pageGroups[0].templateRef).toBe('Blank') // content preserved

      // Both original and fork should be in the store
      const result = readNotebookStore(storePath(base))
      expect(result.drafts).toHaveLength(2)
    })

    it('increments copy counter to avoid name collisions', () => {
      const store: NotebookDraftStore = {
        version: 1,
        drafts: [
          makeDraft({ id: 'src-1', name: 'My Notebook' }),
          makeDraft({ id: 'existing-copy', name: 'My Notebook (Copy)' }),
        ],
      }
      writeFileSync(storePath(base), JSON.stringify(store))

      const forked = forkDraft(storePath(base), 'src-1')
      expect(forked!.name).toBe('My Notebook (Copy 2)')
    })

    it('uses custom name if provided', () => {
      const store: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft({ id: 'src-1', name: 'My Notebook' })],
      }
      writeFileSync(storePath(base), JSON.stringify(store))

      const forked = forkDraft(storePath(base), 'src-1', 'Custom Fork Name')
      expect(forked!.name).toBe('Custom Fork Name')
    })

    it('returns null for non-existent source id', () => {
      const store: NotebookDraftStore = { version: 1, drafts: [] }
      writeFileSync(storePath(base), JSON.stringify(store))

      const forked = forkDraft(storePath(base), 'nope')
      expect(forked).toBeNull()
    })

    it('does not copy deployedUuid to fork', () => {
      const store: NotebookDraftStore = {
        version: 1,
        drafts: [makeDraft({ id: 'src-1', deployedUuid: 'deployed-uuid-123' })],
      }
      writeFileSync(storePath(base), JSON.stringify(store))

      const forked = forkDraft(storePath(base), 'src-1')
      expect(forked!.deployedUuid).toBeUndefined()
    })
  })
})
