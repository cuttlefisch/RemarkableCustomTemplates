/**
 * NDJSON streaming helper for Fastify.
 *
 * Writes newline-delimited JSON events to the raw HTTP response,
 * enabling real-time progress updates for long-running device operations.
 */

import type { FastifyReply } from 'fastify'

/**
 * Handle for writing NDJSON events to an HTTP response stream.
 * Each method writes one JSON line and flushes immediately.
 */
export interface NdjsonStream {
  /** Emit a progress event with an optional numeric counter. */
  progress(phase: string, current?: number, total?: number): void
  /** Emit a success event with additional data and close the stream. */
  done(data: Record<string, unknown>): void
  /** Emit an error event with optional troubleshooting hint and close the stream. */
  error(message: string, hint?: string, rawError?: string): void
}

/**
 * Initialize an NDJSON streaming response for a Fastify request.
 * Sets chunked transfer encoding and `application/x-ndjson` content type,
 * then returns a handle for writing progress, done, and error events.
 * @param reply - The Fastify reply object (bypasses Fastify serialization via `reply.raw`).
 * @returns An {@link NdjsonStream} for writing events.
 */
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
    error(message, hint?, rawError?) {
      const event: Record<string, unknown> = { type: 'error', error: message }
      if (hint) event.hint = hint
      if (rawError) event.rawError = rawError
      write(event)
      reply.raw.end()
    },
  }
}
