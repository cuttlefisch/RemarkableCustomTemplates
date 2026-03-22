// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import type { NotebookDraft } from '../hooks/useNotebookList'

const STORAGE_KEY = 'notebook-drafts'

// Simple in-memory localStorage mock for testing
const store = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
}

function loadDrafts(): NotebookDraft[] {
  try {
    const raw = mockLocalStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as NotebookDraft[] : []
  } catch {
    return []
  }
}

function saveDrafts(drafts: NotebookDraft[]) {
  mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
}

function makeDraft(overrides: Partial<NotebookDraft> = {}): NotebookDraft {
  return {
    id: crypto.randomUUID(),
    name: 'Test Notebook',
    pageGroups: [],
    deviceId: 'rm',
    orientation: 'portrait',
    lastModified: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  mockLocalStorage.clear()
})

describe('notebook draft persistence', () => {
  it('returns empty array when no drafts exist', () => {
    expect(loadDrafts()).toEqual([])
  })

  it('saves and loads a draft', () => {
    const draft = makeDraft({ name: 'My Notebook' })
    saveDrafts([draft])
    const loaded = loadDrafts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('My Notebook')
  })

  it('saves multiple drafts', () => {
    const d1 = makeDraft({ name: 'First' })
    const d2 = makeDraft({ name: 'Second' })
    saveDrafts([d1, d2])
    const loaded = loadDrafts()
    expect(loaded).toHaveLength(2)
    expect(loaded[0].name).toBe('First')
    expect(loaded[1].name).toBe('Second')
  })

  it('updates a draft by id', () => {
    const d1 = makeDraft({ name: 'Original' })
    saveDrafts([d1])

    const updated = loadDrafts().map(d =>
      d.id === d1.id ? { ...d, name: 'Updated' } : d,
    )
    saveDrafts(updated)

    const loaded = loadDrafts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Updated')
  })

  it('removes a draft by id', () => {
    const d1 = makeDraft({ name: 'Keep' })
    const d2 = makeDraft({ name: 'Remove' })
    saveDrafts([d1, d2])

    const filtered = loadDrafts().filter(d => d.id !== d2.id)
    saveDrafts(filtered)

    const loaded = loadDrafts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Keep')
  })

  it('preserves page groups', () => {
    const draft = makeDraft({
      pageGroups: [
        { id: 'g1', templateRef: 'Blank', templateName: 'Blank', count: 3 },
        { id: 'g2', templateRef: 'Dots', templateName: 'Dots', count: 1 },
      ],
    })
    saveDrafts([draft])
    const loaded = loadDrafts()
    expect(loaded[0].pageGroups).toHaveLength(2)
    expect(loaded[0].pageGroups[0].count).toBe(3)
  })

  it('preserves device and orientation', () => {
    const draft = makeDraft({ deviceId: 'rmPP', orientation: 'landscape' })
    saveDrafts([draft])
    const loaded = loadDrafts()
    expect(loaded[0].deviceId).toBe('rmPP')
    expect(loaded[0].orientation).toBe('landscape')
  })

  it('handles corrupt data gracefully', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'not valid json')
    expect(loadDrafts()).toEqual([])
  })

  it('forks a draft with new id and "(Copy)" suffix', () => {
    const original = makeDraft({ name: 'My Notebook', pageGroups: [
      { id: 'g1', templateRef: 'Blank', templateName: 'Blank', count: 3 },
    ]})
    saveDrafts([original])

    // Simulate fork logic from useNotebookList
    const source = loadDrafts().find(d => d.id === original.id)!
    const fork: NotebookDraft = {
      id: crypto.randomUUID(),
      name: `${source.name} (Copy)`,
      pageGroups: source.pageGroups.map(g => ({ ...g, id: crypto.randomUUID() })),
      deviceId: source.deviceId,
      orientation: source.orientation,
      lastModified: Date.now(),
    }
    saveDrafts([fork, ...loadDrafts()])

    const loaded = loadDrafts()
    expect(loaded).toHaveLength(2)
    expect(loaded[0].name).toBe('My Notebook (Copy)')
    expect(loaded[0].id).not.toBe(original.id)
    expect(loaded[0].pageGroups[0].id).not.toBe('g1')
    expect(loaded[0].pageGroups[0].templateRef).toBe('Blank')
    expect(loaded[0].pageGroups[0].count).toBe(3)
  })
})
