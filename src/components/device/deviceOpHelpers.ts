/**
 * Shared non-component utilities for device operation components.
 * Types, NDJSON stream reader, and hooks.
 */

import { useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export type OpResult =
  | { ok: true; message: string; steps?: string[]; log?: string; warnings?: string[] }
  | { ok: false; error: string; hint?: string; rawError?: string; details?: string[] }

export interface ProgressState {
  phase: string
  current?: number
  total?: number
}

// ── NDJSON stream reader ─────────────────────────────────────────────────────

export async function readNdjsonStream(
  response: Response,
  onProgress: (p: ProgressState) => void,
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
          phase: event.phase as string,
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

// ── useDeviceOp hook ─────────────────────────────────────────────────────────

export function useDeviceOp(url: string, options?: { confirmMsg?: string; onSuccess?: () => void; bodyFn?: () => Record<string, unknown> | undefined }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OpResult | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)

  async function run() {
    if (options?.confirmMsg && !window.confirm(options.confirmMsg)) return
    setLoading(true)
    setResult(null)
    setProgress(null)
    try {
      const body = options?.bodyFn?.()
      const fetchOptions: RequestInit = { method: 'POST' }
      if (body) {
        fetchOptions.headers = { 'Content-Type': 'application/json' }
        fetchOptions.body = JSON.stringify(body)
      }
      const res = await fetch(url, fetchOptions)
      const contentType = res.headers.get('content-type') ?? ''

      let data: Record<string, unknown>
      if (contentType.includes('application/x-ndjson')) {
        data = await readNdjsonStream(res, setProgress)
      } else {
        data = (await res.json()) as Record<string, unknown>
        if (!res.ok) {
          const hint = data.hint as string | undefined
          const rawError = data.rawError as string | undefined
          const details = data.details as string[] | undefined
          const error = (data.error as string) ?? `HTTP ${res.status}`
          console.error('[device-op]', url, rawError ?? error)
          setResult({ ok: false, error, hint, rawError, details })
          return
        }
      }

      const steps = data.steps as string[] | undefined
      const count = data.count as number | undefined
      const message = data.message as string | undefined
      const restoredFrom = data.restoredFrom as string | undefined
      const warnings = data.warnings as string[] | undefined
      const msg =
        message ??
        ((steps ? steps.join(' \u2192 ') : '') ||
        (count !== undefined ? `Pulled ${count} templates` : '') ||
        (restoredFrom ? `Restored from ${restoredFrom}` : 'Done'))
      setResult({ ok: true, message: msg, steps, warnings })
      options?.onSuccess?.()
    } catch (e) {
      if (e && typeof e === 'object' && 'error' in e) {
        const streamErr = e as { error: string; hint?: string; rawError?: string }
        console.error('[device-op]', url, streamErr.rawError ?? streamErr.error)
        setResult({ ok: false, error: streamErr.error, hint: streamErr.hint, rawError: streamErr.rawError })
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[device-op]', url, msg)
        setResult({ ok: false, error: msg, rawError: msg })
      }
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  return { loading, result, progress, run }
}
