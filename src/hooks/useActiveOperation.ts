/**
 * Poll for an in-progress or recently completed device operation.
 *
 * On mount and window focus, fetches GET /api/devices/:id/active-operation.
 * While an operation is running, polls every 2 seconds for progress updates.
 * Returns the tracked operation state for client-side recovery after page refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface ActiveOperation {
  operationName: string
  status: 'running' | 'done' | 'error'
  startedAt: number
  finishedAt: number | null
  lastProgress: { phase: string; current?: number; total?: number } | null
  doneData: Record<string, unknown> | null
  errorData: { message: string; hint?: string; rawError?: string } | null
}

interface UseActiveOperationResult {
  /** The active/recent operation, or null if none. */
  activeOp: ActiveOperation | null
  /** True if this operation was recovered (not started by this page session). */
  isRecovered: boolean
  /** Dismiss the recovered operation (user acknowledged it). */
  dismiss: () => void
}

const POLL_INTERVAL = 2000

export function useActiveOperation(deviceId: string | null): UseActiveOperationResult {
  const [activeOp, setActiveOp] = useState<ActiveOperation | null>(null)
  const [isRecovered, setIsRecovered] = useState(false)
  // Track operation names started by this session so we don't show them as "recovered"
  const localOpsRef = useRef(new Set<string>())
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchOp = useCallback(async () => {
    if (!deviceId) { setActiveOp(null); return }
    try {
      const res = await fetch(`/api/devices/${deviceId}/active-operation`)
      const data = await res.json() as Record<string, unknown>
      if (!data.active) {
        setActiveOp(null)
        setIsRecovered(false)
        return
      }
      const op = data as unknown as ActiveOperation & { active: boolean }
      setActiveOp(op)
      // If this op wasn't started by our session, it's recovered
      if (!localOpsRef.current.has(`${op.operationName}-${op.startedAt}`)) {
        setIsRecovered(true)
      }
    } catch {
      // Network error — don't clear state, just skip this poll
    }
  }, [deviceId])

  // Initial fetch + focus listener
  useEffect(() => {
    fetchOp()
    const onFocus = () => fetchOp()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchOp])

  // Poll while running
  useEffect(() => {
    if (activeOp?.status === 'running') {
      pollingRef.current = setInterval(fetchOp, POLL_INTERVAL)
    } else {
      clearInterval(pollingRef.current)
    }
    return () => clearInterval(pollingRef.current)
  }, [activeOp?.status, fetchOp])

  // Reset when device changes
  useEffect(() => {
    setActiveOp(null)
    setIsRecovered(false)
    localOpsRef.current.clear()
  }, [deviceId])

  const dismiss = useCallback(() => {
    setActiveOp(null)
    setIsRecovered(false)
  }, [])

  return { activeOp, isRecovered, dismiss }
}

/**
 * Register an operation as started by this session, so it won't
 * show as "recovered" if the user polls while it's still running.
 */
export function markLocalOperation(
  ref: React.RefObject<Set<string>>,
  operationName: string,
): void {
  ref.current.add(`${operationName}-${Date.now()}`)
}
