/**
 * Notebook draft store — versioned JSON file, full-rewrite on each mutation.
 * Follows the same pattern as deviceStore.ts.
 *
 * Storage format (v1):
 *   { "version": 1, "drafts": [...] }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { NotebookDraft } from '../../src/types/notebook.ts'

/**
 * Persisted notebook draft store (v1 format).
 * Stored on disk as `data/notebooks.json`.
 */
export interface NotebookDraftStore {
  version: 1
  drafts: NotebookDraft[]
}

function emptyStore(): NotebookDraftStore {
  return { version: 1, drafts: [] }
}

/**
 * Read the notebook draft store from disk.
 * @param storePath - Absolute path to `notebooks.json`.
 * @returns The deserialized store, or an empty store if the file is missing or corrupt.
 */
export function readNotebookStore(storePath: string): NotebookDraftStore {
  if (!existsSync(storePath)) return emptyStore()

  try {
    const raw = JSON.parse(readFileSync(storePath, 'utf8'))
    if (raw.version === 1 && Array.isArray(raw.drafts)) {
      return raw as NotebookDraftStore
    }
    return emptyStore()
  } catch {
    return emptyStore()
  }
}

/**
 * Persist the notebook draft store to disk. Creates parent directories if needed.
 * @param storePath - Absolute path to `notebooks.json`.
 * @param store - The store to serialize.
 */
export function writeNotebookStore(storePath: string, store: NotebookDraftStore): void {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8')
}

/**
 * Insert or update a notebook draft by its ID.
 * @param storePath - Absolute path to `notebooks.json`.
 * @param draft - The draft to insert or replace.
 */
export function upsertDraft(storePath: string, draft: NotebookDraft): void {
  const store = readNotebookStore(storePath)
  const idx = store.drafts.findIndex(d => d.id === draft.id)
  if (idx >= 0) {
    store.drafts[idx] = draft
  } else {
    store.drafts.push(draft)
  }
  writeNotebookStore(storePath, store)
}

/**
 * Remove a notebook draft by its ID. No-op if the draft doesn't exist.
 * @param storePath - Absolute path to `notebooks.json`.
 * @param id - The draft UUID to remove.
 */
export function removeDraft(storePath: string, id: string): void {
  const store = readNotebookStore(storePath)
  store.drafts = store.drafts.filter(d => d.id !== id)
  writeNotebookStore(storePath, store)
}

/**
 * Duplicate a draft with fresh UUIDs for the notebook and all page groups.
 * The forked copy has no `deployedUuid` — it's treated as a new, undeployed notebook.
 * Auto-generates a unique name like "Name (Copy)" or "Name (Copy 2)" if no custom name is given.
 * @param storePath - Absolute path to `notebooks.json`.
 * @param sourceId - The UUID of the draft to fork.
 * @param customName - Optional explicit name for the fork (skips auto-naming).
 * @returns The newly created draft, or null if the source doesn't exist.
 */
export function forkDraft(storePath: string, sourceId: string, customName?: string): NotebookDraft | null {
  const store = readNotebookStore(storePath)
  const source = store.drafts.find(d => d.id === sourceId)
  if (!source) return null

  let copyName: string
  if (customName) {
    copyName = customName
  } else {
    const baseName = source.name || 'Untitled'
    copyName = `${baseName} (Copy)`
    let counter = 2
    while (store.drafts.some(d => d.name === copyName)) {
      copyName = `${baseName} (Copy ${counter})`
      counter++
    }
  }

  const fork: NotebookDraft = {
    id: randomUUID(),
    name: copyName,
    pageGroups: source.pageGroups.map(g => ({ ...g, id: randomUUID() })),
    deviceId: source.deviceId,
    orientation: source.orientation,
    lastModified: Date.now(),
    // deployedUuid is intentionally NOT copied — fork is a new notebook
  }

  store.drafts.push(fork)
  writeNotebookStore(storePath, store)
  return fork
}
