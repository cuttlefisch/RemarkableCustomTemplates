/**
 * NDJSON streaming helper for Fastify.
 *
 * Writes newline-delimited JSON events to the raw HTTP response,
 * enabling real-time progress updates for long-running device operations.
 */

import type { FastifyReply } from 'fastify'

export interface NdjsonStream {
  progress(phase: string, current?: number, total?: number): void
  done(data: Record<string, unknown>): void
  error(message: string, hint?: string): void
}

export function createNdjsonStream(reply: FastifyReply): NdjsonStream {
  reply.raw.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache',
    'Transfer-Encoding': 'chunked',
  })

  function write(obj: Record<string, unknown>) {
    reply.raw.write(JSON.stringify(obj) + '\n')
  }

  return {
    progress(phase, current?, total?) {
      const event: Record<string, unknown> = { type: 'progress', phase }
      if (current !== undefined) event.current = current
      if (total !== undefined) event.total = total
      write(event)
    },
    done(data) {
      write({ type: 'done', ok: true, ...data })
      reply.raw.end()
    },
    error(message, hint?) {
      const event: Record<string, unknown> = { type: 'error', error: message }
      if (hint) event.hint = hint
      write(event)
      reply.raw.end()
    },
  }
}
