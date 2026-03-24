/**
 * Shared NDJSON streaming client for reading server-sent progress events.
 */

/** A progress event emitted by the server during long-running NDJSON operations. */
export interface NdjsonProgress {
  /** Human-readable description of the current phase. */
  phase: string
  /** Current step number (for progress bars). */
  current?: number
  /** Total number of steps (for progress bars). */
  total?: number
}

/** An error event from the NDJSON stream. */
export interface NdjsonError {
  /** Machine/human-readable error message. */
  error: string
  /** Optional user-friendly hint for resolving the error. */
  hint?: string
  /** Optional raw error message from the underlying operation. */
  rawError?: string
}

/**
 * Read an NDJSON response stream, calling `onProgress` for each progress event.
 *
 * The stream contains newline-delimited JSON objects with a `type` field:
 * `"progress"`, `"done"`, or `"error"`. Progress events are forwarded to the
 * callback; the final `"done"` event is returned as the resolved value.
 *
 * @param response - A fetch Response with a readable body stream
 * @param onProgress - Callback invoked for each progress event
 * @returns The final `"done"` event data
 * @throws {NdjsonError} If the stream contains an error event or has no body
 */
export async function readNdjsonStream(
  response: Response,
  onProgress: (p: NdjsonProgress) => void,
): Promise<Record<string, unknown>> {
  if (!response.body) {
    throw { error: 'Response has no body stream' } as NdjsonError
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalData: Record<string, unknown> = {}

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop()! // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line) as Record<string, unknown>
      if (event.type === 'progress') {
        onProgress({
          phase: (event.phase ?? event.message) as string,
          current: event.current as number | undefined,
          total: event.total as number | undefined,
        })
      } else if (event.type === 'done') {
        finalData = event
      } else if (event.type === 'error') {
        throw { error: event.error as string, hint: event.hint as string | undefined, rawError: event.rawError as string | undefined }
      }
    }
  }

  return finalData
}
