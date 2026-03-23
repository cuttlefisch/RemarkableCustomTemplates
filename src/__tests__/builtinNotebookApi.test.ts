// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchBuiltinNotebooks,
  fetchHiddenNotebooks,
  hideNotebookApi,
  restoreAllNotebooksApi,
} from '../lib/builtinNotebookApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('builtin notebook API client', () => {
  describe('fetchBuiltinNotebooks', () => {
    it('fetches from /api/builtin-notebooks', async () => {
      const notebooks = [{ id: '__sample-notebook__', name: 'Sample', source: 'sample' }]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notebooks }),
      })

      const result = await fetchBuiltinNotebooks()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('__sample-notebook__')
      expect(mockFetch).toHaveBeenCalledWith('/api/builtin-notebooks')
    })

    it('throws on server error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
      await expect(fetchBuiltinNotebooks()).rejects.toThrow('Failed to fetch built-in notebooks: 500')
    })
  })

  describe('fetchHiddenNotebooks', () => {
    it('fetches from /api/builtin-notebooks/hidden', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hidden: ['__sample-notebook__'] }),
      })

      const result = await fetchHiddenNotebooks()
      expect(result).toEqual(['__sample-notebook__'])
      expect(mockFetch).toHaveBeenCalledWith('/api/builtin-notebooks/hidden')
    })
  })

  describe('hideNotebookApi', () => {
    it('sends POST with id', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

      await hideNotebookApi('__sample-notebook__')
      expect(mockFetch).toHaveBeenCalledWith('/api/builtin-notebooks/hide', expect.objectContaining({
        method: 'POST',
      }))
      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.id).toBe('__sample-notebook__')
    })

    it('throws on server error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
      await expect(hideNotebookApi('__test__')).rejects.toThrow('Failed to hide notebook: 500')
    })
  })

  describe('restoreAllNotebooksApi', () => {
    it('sends POST to restore-all', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

      await restoreAllNotebooksApi()
      expect(mockFetch).toHaveBeenCalledWith('/api/builtin-notebooks/restore-all', expect.objectContaining({
        method: 'POST',
      }))
    })
  })
})
