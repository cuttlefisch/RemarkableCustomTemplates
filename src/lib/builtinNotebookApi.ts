/**
 * Thin fetch wrappers for the built-in notebook API.
 */

import type { NotebookDraft } from '../types/notebook'

const BASE = '/api/builtin-notebooks'

export async function fetchBuiltinNotebooks(): Promise<NotebookDraft[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error(`Failed to fetch built-in notebooks: ${res.status}`)
  const data = (await res.json()) as { notebooks: NotebookDraft[] }
  return data.notebooks
}

export async function fetchHiddenNotebooks(): Promise<string[]> {
  const res = await fetch(`${BASE}/hidden`)
  if (!res.ok) throw new Error(`Failed to fetch hidden notebooks: ${res.status}`)
  const data = (await res.json()) as { hidden: string[] }
  return data.hidden
}

export async function hideNotebookApi(id: string): Promise<void> {
  const res = await fetch(`${BASE}/hide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(`Failed to hide notebook: ${res.status}`)
}

export async function restoreAllNotebooksApi(): Promise<void> {
  const res = await fetch(`${BASE}/restore-all`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to restore notebooks: ${res.status}`)
}
