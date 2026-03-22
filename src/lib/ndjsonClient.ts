/**
 * Shared NDJSON streaming client for reading server-sent progress events.
 */

export interface NdjsonProgress {
  phase: string
  current?: number
  total?: number
}

export interface NdjsonError {
  error: string
  hint?: string
  rawError?: string
}

/**
 * Read an NDJSON response stream, calling onProgress for each progress event.
 * Returns the final 'done' event data, or throws an NdjsonError on error events.
 */
export async function readNdjsonStream(
  response: Response,
  onProgress: (p: NdjsonProgress) => void,
): Promise<Record<string, unknown>> {
  const reader = response.body!.getReader()
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
