// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NotebookDraft } from '../types/notebook'
import {
  fetchDrafts,
  createDraftApi,
  batchCreateDrafts,
  updateDraftApi,
  deleteDraftApi,
  forkDraftApi,
} from '../lib/notebookDraftApi'

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

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('notebook draft API client', () => {
  describe('fetchDrafts', () => {
    it('fetches drafts from server', async () => {
      const drafts = [makeDraft({ name: 'A' }), makeDraft({ name: 'B' })]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ drafts }),
      })

      const result = await fetchDrafts()
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('A')
      expect(mockFetch).toHaveBeenCalledWith('/api/notebook-drafts')
    })

    it('throws on server error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
      await expect(fetchDrafts()).rejects.toThrow('Failed to fetch drafts: 500')
    })
  })

  describe('createDraftApi', () => {
    it('sends POST with draft data', async () => {
      const draft = makeDraft({ name: 'New' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft }),
      })

      const result = await createDraftApi(draft)
      expect(result.name).toBe('New')
      expect(mockFetch).toHaveBeenCalledWith('/api/notebook-drafts', expect.objectContaining({
        method: 'POST',
      }))
    })
  })

  describe('batchCreateDrafts', () => {
    it('sends batch POST for migration', async () => {
      const drafts = [makeDraft(), makeDraft()]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imported: 2 }),
      })

      const count = await batchCreateDrafts(drafts)
      expect(count).toBe(2)
      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.drafts).toHaveLength(2)
    })
  })

  describe('updateDraftApi', () => {
    it('sends PUT with updated draft', async () => {
      const draft = makeDraft({ id: 'upd-1', name: 'Updated' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft }),
      })

      const result = await updateDraftApi(draft)
      expect(result.name).toBe('Updated')
      expect(mockFetch).toHaveBeenCalledWith('/api/notebook-drafts/upd-1', expect.objectContaining({
        method: 'PUT',
      }))
    })

    it('throws on 404', async () => {
      const draft = makeDraft({ id: 'nope' })
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
      await expect(updateDraftApi(draft)).rejects.toThrow('Failed to update draft: 404')
    })
  })

  describe('deleteDraftApi', () => {
    it('sends DELETE for the draft', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await deleteDraftApi('del-1')
      expect(mockFetch).toHaveBeenCalledWith('/api/notebook-drafts/del-1', expect.objectContaining({
        method: 'DELETE',
      }))
    })

    it('throws on 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
      await expect(deleteDraftApi('nope')).rejects.toThrow('Failed to delete draft: 404')
    })
  })

  describe('forkDraftApi', () => {
    it('sends POST to fork endpoint', async () => {
      const forked = makeDraft({ id: 'forked-1', name: 'Copy' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: forked }),
      })

      const result = await forkDraftApi('src-1')
      expect(result.name).toBe('Copy')
      expect(mockFetch).toHaveBeenCalledWith('/api/notebook-drafts/src-1/fork', expect.objectContaining({
        method: 'POST',
      }))
    })

    it('passes custom name in body', async () => {
      const forked = makeDraft({ name: 'Custom Name' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: forked }),
      })

      await forkDraftApi('src-1', 'Custom Name')
      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.name).toBe('Custom Name')
    })

    it('throws on 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
      await expect(forkDraftApi('nope')).rejects.toThrow('Failed to fork draft: 404')
    })
  })
})
