import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { NotebookDraft } from '../types/notebook'
import { getPreferredDeviceType } from '../lib/renderer'
import {
  fetchDrafts,
  createDraftApi,
  updateDraftApi,
  deleteDraftApi,
  forkDraftApi,
  batchCreateDrafts,
} from '../lib/notebookDraftApi'
import {
  fetchBuiltinNotebooks,
  hideNotebookApi,
  restoreAllNotebooksApi,
} from '../lib/builtinNotebookApi'

export type { NotebookDraft } from '../types/notebook'

const MIGRATION_KEY = 'notebook-drafts'

export function useNotebookList() {
  const [drafts, setDrafts] = useState<NotebookDraft[]>([])
  const [builtins, setBuiltins] = useState<NotebookDraft[]>([])
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  // Fetch drafts + builtins on mount
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    async function init() {
      try {
        const [serverDrafts, serverBuiltins] = await Promise.all([
          fetchDrafts(),
          fetchBuiltinNotebooks().catch(() => [] as NotebookDraft[]),
        ])

        // Silent migration: if server is empty but localStorage has data, migrate
        if (serverDrafts.length === 0) {
          try {
            const raw = localStorage.getItem(MIGRATION_KEY)
            if (raw) {
              const localDrafts = JSON.parse(raw) as NotebookDraft[]
              if (localDrafts.length > 0) {
                await batchCreateDrafts(localDrafts)
                localStorage.removeItem(MIGRATION_KEY)
                if (!cancelled) {
                  setDrafts(localDrafts)
                  setBuiltins(serverBuiltins)
                  setLoading(false)
                }
                return
              }
            }
          } catch {
            // Migration failed — not critical, just proceed with server state
          }
        }

        if (!cancelled) {
          setDrafts(serverDrafts)
          setBuiltins(serverBuiltins)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [])

  // Merged list: builtins first, then user drafts
  const allNotebooks = useMemo(
    () => [...builtins, ...drafts],
    [builtins, drafts],
  )

  const hiddenCount = hiddenIds.length

  const createDraft = useCallback((): NotebookDraft => {
    // Compute next available "Notebook N" name from current state
    const usedNumbers = new Set(
      drafts
        .map(d => d.name.match(/^Notebook (\d+)$/))
        .filter(Boolean)
        .map(m => parseInt(m![1], 10)),
    )
    let n = 1
    while (usedNumbers.has(n)) n++

    const draft: NotebookDraft = {
      id: crypto.randomUUID(),
      name: `Notebook ${n}`,
      pageGroups: [],
      deviceId: getPreferredDeviceType(),
      orientation: 'portrait',
      lastModified: Date.now(),
    }

    // Optimistic update
    setDrafts(prev => [draft, ...prev])

    // Fire-and-forget API call; re-fetch on failure
    createDraftApi(draft).catch(() => {
      fetchDrafts().then(d => { if (mountedRef.current) setDrafts(d) }).catch(() => {})
    })

    return draft
  }, [drafts])

  const updateDraft = useCallback((draft: NotebookDraft) => {
    const updated = { ...draft, lastModified: Date.now() }

    // Optimistic update
    setDrafts(prev => {
      const idx = prev.findIndex(d => d.id === draft.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [updated, ...prev]
    })

    // Fire-and-forget API call
    updateDraftApi(updated).catch(() => {
      fetchDrafts().then(d => { if (mountedRef.current) setDrafts(d) }).catch(() => {})
    })
  }, [])

  const removeDraft = useCallback((id: string) => {
    // Defense in depth: reject system notebook IDs
    if (id.startsWith('__')) return

    // Optimistic update
    setDrafts(prev => prev.filter(d => d.id !== id))

    // Fire-and-forget
    deleteDraftApi(id).catch(() => {
      fetchDrafts().then(d => { if (mountedRef.current) setDrafts(d) }).catch(() => {})
    })
  }, [])

  const getDraft = useCallback((id: string): NotebookDraft | undefined => {
    return drafts.find(d => d.id === id) ?? builtins.find(b => b.id === id)
  }, [drafts, builtins])

  const forkDraft = useCallback((id: string, customName?: string): NotebookDraft | null => {
    // Look up in both drafts and builtins
    const source = drafts.find(d => d.id === id) ?? builtins.find(b => b.id === id)
    if (!source) return null

    // Build optimistic fork locally
    let copyName: string
    if (customName) {
      copyName = customName
    } else {
      const baseName = source.name || 'Untitled'
      copyName = `${baseName} (Copy)`
      let counter = 2
      while (drafts.some(d => d.name === copyName)) {
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

    // Optimistic update — add to user drafts
    setDrafts(prev => [fork, ...prev])

    // For builtin sources, create directly (no server-side fork endpoint)
    // For user drafts, use the fork API
    if (source.source === 'sample' || source.source === 'debug') {
      createDraftApi(fork).catch(() => {
        fetchDrafts().then(d => { if (mountedRef.current) setDrafts(d) }).catch(() => {})
      })
    } else {
      forkDraftApi(id, customName).catch(() => {
        fetchDrafts().then(d => { if (mountedRef.current) setDrafts(d) }).catch(() => {})
      })
    }

    return fork
  }, [drafts, builtins])

  const hideNotebook = useCallback((id: string) => {
    // Optimistic: remove from builtins, add to hiddenIds
    setBuiltins(prev => prev.filter(b => b.id !== id))
    setHiddenIds(prev => prev.includes(id) ? prev : [...prev, id])

    hideNotebookApi(id).catch(() => {
      // Re-fetch on failure
      fetchBuiltinNotebooks().then(b => { if (mountedRef.current) setBuiltins(b) }).catch(() => {})
    })
  }, [])

  const restoreAll = useCallback(() => {
    // Optimistic: clear hidden, re-fetch builtins
    setHiddenIds([])

    restoreAllNotebooksApi().then(() => {
      return fetchBuiltinNotebooks()
    }).then(b => {
      if (mountedRef.current) setBuiltins(b)
    }).catch(() => {})
  }, [])

  const refresh = useCallback(() => {
    Promise.all([
      fetchDrafts(),
      fetchBuiltinNotebooks().catch(() => [] as NotebookDraft[]),
    ]).then(([d, b]) => {
      if (mountedRef.current) {
        setDrafts(d)
        setBuiltins(b)
      }
    }).catch(() => {})
  }, [])

  return {
    drafts,
    builtins,
    allNotebooks,
    hiddenCount,
    loading,
    createDraft,
    updateDraft,
    removeDraft,
    getDraft,
    forkDraft,
    hideNotebook,
    restoreAll,
    refresh,
  }
}
