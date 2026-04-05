/**
 * Shared non-component utilities for device operation components.
 * Types and hooks. NDJSON streaming is re-exported from the canonical lib.
 */

import { useState } from 'react'
import { readNdjsonStream } from '../../lib/ndjsonClient'
import type { NdjsonProgress } from '../../lib/ndjsonClient'

// Re-export from canonical source so existing consumers don't break
export { readNdjsonStream }

// ── Types ────────────────────────────────────────────────────────────────────

export type OpResult =
  | { ok: true; message: string; steps?: string[]; log?: string; warnings?: string[] }
  | { ok: false; error: string; hint?: string; rawError?: string; details?: string[] }

export type ProgressState = NdjsonProgress

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
