/**
 * Client-side API calls for notebook export and deploy.
 */

import type { NotebookDefinition } from '../types/notebook'
import { readNdjsonStream } from './ndjsonClient'

/** Export notebook as a downloadable ZIP blob */
export async function exportNotebook(definition: NotebookDefinition): Promise<Blob> {
  const res = await fetch('/api/notebooks/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(definition),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Export failed' })) as { error?: string }
    throw new Error(err.error || `Export failed (${res.status})`)
  }
  return res.blob()
}

/** Check if a previously deployed notebook still exists on the device by UUID */
export async function checkNotebook(
  deviceId: string,
  uuid: string,
): Promise<{ exists: boolean; uuid?: string; pristine?: boolean; pageCount?: number; visibleName?: string }> {
  const res = await fetch(`/api/devices/${deviceId}/check-notebook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Check failed' })) as { error?: string }
    throw new Error(err.error || `Check failed (${res.status})`)
  }
  return res.json() as Promise<{ exists: boolean; uuid?: string; pristine?: boolean; pageCount?: number; visibleName?: string }>
}

/** Deploy notebook to device, streaming NDJSON progress events */
export async function deployNotebook(
  deviceId: string,
  definition: NotebookDefinition,
  onProgress: (message: string) => void,
): Promise<{ steps: string[]; notebookUuid: string }> {
  const res = await fetch(`/api/devices/${deviceId}/deploy-notebook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(definition),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Deploy failed' })) as { error?: string }
    throw new Error(err.error || `Deploy failed (${res.status})`)
  }

  const data = await readNdjsonStream(res, p => {
    onProgress(p.phase)
  })

  return {
    steps: (data.steps as string[]) ?? [],
    notebookUuid: (data.notebookUuid as string) ?? '',
  }
}
