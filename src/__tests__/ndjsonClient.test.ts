import { describe, it, expect, vi } from 'vitest'
import { readNdjsonStream } from '../lib/ndjsonClient'

/** Build a mock Response whose body yields the given string chunks */
function mockResponse(...chunks: string[]): Response {
  let i = 0
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]))
      } else {
        controller.close()
      }
    },
  })
  return { body: stream } as unknown as Response
}

describe('readNdjsonStream', () => {
  it('parses progress events and calls onProgress', async () => {
    const res = mockResponse('{"type":"progress","phase":"uploading","current":1,"total":5}\n')
    const onProgress = vi.fn()
    await readNdjsonStream(res, onProgress)

    expect(onProgress).toHaveBeenCalledWith({ phase: 'uploading', current: 1, total: 5 })
  })

  it('returns done event data', async () => {
    const res = mockResponse('{"type":"done","ok":true,"notebookUuid":"abc-123"}\n')
    const result = await readNdjsonStream(res, vi.fn())

    expect(result).toEqual({ type: 'done', ok: true, notebookUuid: 'abc-123' })
  })

  it('throws on error events with NdjsonError shape', async () => {
    const res = mockResponse('{"type":"error","error":"SSH failed","hint":"check keys","rawError":"ECONNREFUSED"}\n')

    await expect(readNdjsonStream(res, vi.fn())).rejects.toEqual({
      error: 'SSH failed',
      hint: 'check keys',
      rawError: 'ECONNREFUSED',
    })
  })

  it('handles data split across multiple chunks', async () => {
    // Split a single JSON line across two chunks
    const res = mockResponse(
      '{"type":"progress","pha',
      'se":"building","current":2,"total":10}\n',
    )
    const onProgress = vi.fn()
    await readNdjsonStream(res, onProgress)

    expect(onProgress).toHaveBeenCalledWith({ phase: 'building', current: 2, total: 10 })
  })

  it('handles multiple progress events then done', async () => {
    const lines = [
      '{"type":"progress","phase":"step1","current":1,"total":3}\n',
      '{"type":"progress","phase":"step2","current":2,"total":3}\n',
      '{"type":"progress","phase":"step3","current":3,"total":3}\n',
      '{"type":"done","ok":true,"result":"success"}\n',
    ].join('')
    const res = mockResponse(lines)
    const onProgress = vi.fn()
    const result = await readNdjsonStream(res, onProgress)

    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenNthCalledWith(1, { phase: 'step1', current: 1, total: 3 })
    expect(onProgress).toHaveBeenNthCalledWith(3, { phase: 'step3', current: 3, total: 3 })
    expect(result).toMatchObject({ ok: true, result: 'success' })
  })

  it('falls back to event.message when phase is missing', async () => {
    const res = mockResponse('{"type":"progress","message":"fallback msg"}\n')
    const onProgress = vi.fn()
    await readNdjsonStream(res, onProgress)

    expect(onProgress).toHaveBeenCalledWith({ phase: 'fallback msg', current: undefined, total: undefined })
  })

  it('skips blank lines between events', async () => {
    const res = mockResponse('{"type":"progress","phase":"a"}\n\n\n{"type":"done","ok":true}\n')
    const onProgress = vi.fn()
    const result = await readNdjsonStream(res, onProgress)

    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ ok: true })
  })
})
