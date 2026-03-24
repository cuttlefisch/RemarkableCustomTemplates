/**
 * Thin fetch wrappers for the notebook draft CRUD API.
 */

import type { NotebookDraft } from '../types/notebook'

const BASE = '/api/notebook-drafts'

/** Fetch all user notebook drafts from the server. */
export async function fetchDrafts(): Promise<NotebookDraft[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error(`Failed to fetch drafts: ${res.status}`)
  const data = (await res.json()) as { drafts: NotebookDraft[] }
  return data.drafts
}

/** Create a single notebook draft on the server. */
export async function createDraftApi(draft: NotebookDraft): Promise<NotebookDraft> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  if (!res.ok) throw new Error(`Failed to create draft: ${res.status}`)
  const data = (await res.json()) as { draft: NotebookDraft }
  return data.draft
}

/** Batch-create multiple drafts in a single request (used for localStorage migration). */
export async function batchCreateDrafts(drafts: NotebookDraft[]): Promise<number> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drafts }),
  })
  if (!res.ok) throw new Error(`Failed to batch-create drafts: ${res.status}`)
  const data = (await res.json()) as { imported: number }
  return data.imported
}

/** Update an existing notebook draft by ID. */
export async function updateDraftApi(draft: NotebookDraft): Promise<NotebookDraft> {
  const res = await fetch(`${BASE}/${draft.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  if (!res.ok) throw new Error(`Failed to update draft: ${res.status}`)
  const data = (await res.json()) as { draft: NotebookDraft }
  return data.draft
}

/** Delete a notebook draft by ID. */
export async function deleteDraftApi(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete draft: ${res.status}`)
}

/**
 * Fork (duplicate) a notebook draft server-side.
 * @param id - The source draft ID to fork.
 * @param customName - Optional name for the forked copy; server auto-generates if omitted.
 */
export async function forkDraftApi(id: string, customName?: string): Promise<NotebookDraft> {
  const res = await fetch(`${BASE}/${id}/fork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customName ? { name: customName } : {}),
  })
  if (!res.ok) throw new Error(`Failed to fork draft: ${res.status}`)
  const data = (await res.json()) as { draft: NotebookDraft }
  return data.draft
}
