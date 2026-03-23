import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportNotebook, checkNotebook, deployNotebook } from '../lib/notebookApi'
import type { NotebookDefinition } from '../types/notebook'

/** Minimal notebook definition for testing */
const stubNotebook: NotebookDefinition = {
  name: 'Test Notebook',
  deviceId: 'rm',
  pageGroups: [],
}

/** Build a mock Response with JSON body */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob(['zip-data'])),
  } as unknown as Response
}

/** Build a mock NDJSON streaming Response */
function ndjsonResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const data = lines.join('')
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(data))
      controller.close()
    },
  })
  return { ok: true, status: 200, body: stream } as unknown as Response
}

describe('exportNotebook', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => { originalFetch = globalThis.fetch })
  afterEach(() => { globalThis.fetch = originalFetch })

  it('returns a Blob on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, {}))

    const blob = await exportNotebook(stubNotebook)
    expect(blob).toBeInstanceOf(Blob)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/notebooks/export', expect.objectContaining({ method: 'POST' }))
  })

  it('throws with error message on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'Invalid notebook' }))

    await expect(exportNotebook(stubNotebook)).rejects.toThrow('Invalid notebook')
  })

  it('throws generic message when JSON parse fails', async () => {
    const res = {
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response
    globalThis.fetch = vi.fn().mockResolvedValue(res)

    await expect(exportNotebook(stubNotebook)).rejects.toThrow('Export failed')
  })
})

describe('checkNotebook', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => { originalFetch = globalThis.fetch })
  afterEach(() => { globalThis.fetch = originalFetch })

  it('returns parsed JSON on success', async () => {
    const body = { exists: true, pristine: true, pageCount: 5 }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    })

    const result = await checkNotebook('device-1', 'uuid-abc')
    expect(result).toEqual(body)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/devices/device-1/check-notebook',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('throws on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(404, { error: 'Not found' }))

    await expect(checkNotebook('device-1', 'uuid-abc')).rejects.toThrow('Not found')
  })
})

describe('deployNotebook', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => { originalFetch = globalThis.fetch })
  afterEach(() => { globalThis.fetch = originalFetch })

  it('streams progress and returns result', async () => {
    const res = ndjsonResponse([
      '{"type":"progress","phase":"Uploading..."}\n',
      '{"type":"progress","phase":"Restarting..."}\n',
      '{"type":"done","ok":true,"steps":["uploaded","restarted"],"notebookUuid":"nb-123"}\n',
    ])
    globalThis.fetch = vi.fn().mockResolvedValue(res)

    const onProgress = vi.fn()
    const result = await deployNotebook('device-1', stubNotebook, onProgress)

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledWith('Uploading...')
    expect(onProgress).toHaveBeenCalledWith('Restarting...')
    expect(result).toEqual({ steps: ['uploaded', 'restarted'], notebookUuid: 'nb-123' })
  })

  it('throws on HTTP error before stream', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'Server error' }))

    await expect(deployNotebook('device-1', stubNotebook, vi.fn())).rejects.toThrow('Server error')
  })
})
