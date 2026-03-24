// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { FastifyReply } from 'fastify'
import { createNdjsonStream } from '../lib/ndjsonStream.ts'

function createMockReply() {
  const chunks: string[] = []
  const mockReply = {
    raw: {
      writeHead: vi.fn(),
      write: (chunk: string) => {
        chunks.push(chunk)
      },
      end: vi.fn(),
    },
  } as unknown as FastifyReply
  return { mockReply, chunks }
}

function parseChunks(chunks: string[]) {
  return chunks.map((c) => JSON.parse(c.trimEnd()))
}

describe('createNdjsonStream', () => {
  describe('headers', () => {
    it('sets correct response headers', () => {
      const { mockReply } = createMockReply()
      createNdjsonStream(mockReply)

      expect(mockReply.raw.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      })
    })
  })

  describe('progress()', () => {
    it('writes a progress event as NDJSON line', () => {
      const { mockReply, chunks } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.progress('Deploying templates')

      const events = parseChunks(chunks)
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ type: 'progress', phase: 'Deploying templates' })
    })

    it('includes current and total when provided', () => {
      const { mockReply, chunks } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.progress('Uploading files', 3, 10)

      const events = parseChunks(chunks)
      expect(events[0]).toEqual({
        type: 'progress',
        phase: 'Uploading files',
        current: 3,
        total: 10,
      })
    })

    it('includes current without total', () => {
      const { mockReply, chunks } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.progress('Processing', 5)

      const events = parseChunks(chunks)
      expect(events[0]).toEqual({ type: 'progress', phase: 'Processing', current: 5 })
      expect(events[0]).not.toHaveProperty('total')
    })

    it('each chunk ends with a newline', () => {
      const { mockReply, chunks } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.progress('step')

      expect(chunks[0]).toMatch(/\n$/)
    })
  })

  describe('done()', () => {
    it('writes done event with ok:true and custom data', () => {
      const { mockReply, chunks } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.done({ deployed: 5, skipped: 2 })

      const events = parseChunks(chunks)
      expect(events[0]).toEqual({
        type: 'done',
        ok: true,
        deployed: 5,
        skipped: 2,
      })
    })

    it('ends the stream', () => {
      const { mockReply } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.done({})

      expect(mockReply.raw.end).toHaveBeenCalled()
    })
  })

  describe('error()', () => {
    it('writes error event with message', () => {
      const { mockReply, chunks } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.error('Something went wrong')

      const events = parseChunks(chunks)
      expect(events[0]).toEqual({ type: 'error', error: 'Something went wrong' })
    })

    it('includes hint when provided', () => {
      const { mockReply, chunks } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.error('Auth failed', 'Check your password')

      const events = parseChunks(chunks)
      expect(events[0]).toEqual({
        type: 'error',
        error: 'Auth failed',
        hint: 'Check your password',
      })
    })

    it('includes rawError when provided', () => {
      const { mockReply, chunks } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.error('Connection failed', 'Try again', 'ECONNREFUSED 10.11.99.1:22')

      const events = parseChunks(chunks)
      expect(events[0]).toEqual({
        type: 'error',
        error: 'Connection failed',
        hint: 'Try again',
        rawError: 'ECONNREFUSED 10.11.99.1:22',
      })
    })

    it('ends the stream', () => {
      const { mockReply } = createMockReply()
      const stream = createNdjsonStream(mockReply)

      stream.error('fail')

      expect(mockReply.raw.end).toHaveBeenCalled()
    })
  })
})
