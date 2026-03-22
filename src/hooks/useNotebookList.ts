import { useState, useCallback } from 'react'
import type { PageGroup } from '../types/notebook'
import { getPreferredDeviceType, type DeviceId } from '../lib/renderer'

const STORAGE_KEY = 'notebook-drafts'

export interface NotebookDraft {
  id: string
  name: string
  pageGroups: PageGroup[]
  deviceId: DeviceId
  orientation: 'portrait' | 'landscape'
  lastModified: number
  /** UUID of the last successful deploy to device (for update-in-place detection) */
  deployedUuid?: string
}

function loadDrafts(): NotebookDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as NotebookDraft[] : []
  } catch {
    return []
  }
}

function saveDrafts(drafts: NotebookDraft[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
}

export function useNotebookList() {
  const [drafts, setDrafts] = useState<NotebookDraft[]>(loadDrafts)

  const createDraft = useCallback((): NotebookDraft => {
    const draft: NotebookDraft = {
      id: crypto.randomUUID(),
      name: '',
      pageGroups: [],
      deviceId: getPreferredDeviceType(),
      orientation: 'portrait',
      lastModified: Date.now(),
    }
    const updated = [draft, ...loadDrafts()]
    saveDrafts(updated)
    setDrafts(updated)
    return draft
  }, [])

  const updateDraft = useCallback((draft: NotebookDraft) => {
    const current = loadDrafts()
    const idx = current.findIndex(d => d.id === draft.id)
    const updated = idx >= 0
      ? current.map(d => d.id === draft.id ? { ...draft, lastModified: Date.now() } : d)
      : [{ ...draft, lastModified: Date.now() }, ...current]
    saveDrafts(updated)
    setDrafts(updated)
  }, [])

  const removeDraft = useCallback((id: string) => {
    const updated = loadDrafts().filter(d => d.id !== id)
    saveDrafts(updated)
    setDrafts(updated)
  }, [])

  const getDraft = useCallback((id: string): NotebookDraft | undefined => {
    return loadDrafts().find(d => d.id === id)
  }, [])

  const forkDraft = useCallback((id: string, customName?: string): NotebookDraft | null => {
    const source = loadDrafts().find(d => d.id === id)
    if (!source) return null

    let copyName: string
    if (customName) {
      copyName = customName
    } else {
      const allDrafts = loadDrafts()
      const baseName = source.name || 'Untitled'
      copyName = `${baseName} (Copy)`
      let counter = 2
      while (allDrafts.some(d => d.name === copyName)) {
        copyName = `${baseName} (Copy ${counter})`
        counter++
      }
    }

    const fork: NotebookDraft = {
      id: crypto.randomUUID(),
      name: copyName,
      pageGroups: source.pageGroups.map(g => ({ ...g, id: crypto.randomUUID() })),
      deviceId: source.deviceId,
      orientation: source.orientation,
      lastModified: Date.now(),
    }
    const updated = [fork, ...loadDrafts()]
    saveDrafts(updated)
    setDrafts(updated)
    return fork
  }, [])

  const refresh = useCallback(() => {
    setDrafts(loadDrafts())
  }, [])

  return { drafts, createDraft, updateDraft, removeDraft, getDraft, forkDraft, refresh }
}
