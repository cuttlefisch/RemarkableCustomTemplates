import { createContext, useContext, useState, useCallback, useRef } from 'react'

/** Global busy/loading state shared across components via context. */
interface BusyState {
  isBusy: boolean
  /** Increment/decrement the busy counter. Multiple callers can hold it busy simultaneously. */
  setBusy: (busy: boolean) => void
}

/** React context for a global busy indicator (e.g., during deploy or export operations). */
export const BusyContext = createContext<BusyState>({ isBusy: false, setBusy: () => {} })

/**
 * Consume the global busy state from `BusyContext`.
 * @returns `{ isBusy, setBusy }` to read and toggle the busy indicator.
 */
export function useBusy() {
  return useContext(BusyContext)
}

/**
 * Create ref-counted busy state for use in App.tsx.
 * Multiple components can call setBusy(true) independently —
 * isBusy stays true until all have called setBusy(false).
 */
export function useBusyProvider() {
  const countRef = useRef(0)
  const [isBusy, setIsBusy] = useState(false)

  const setBusy = useCallback((busy: boolean) => {
    if (busy) {
      countRef.current++
    } else {
      countRef.current = Math.max(0, countRef.current - 1)
    }
    setIsBusy(countRef.current > 0)
  }, [])

  return { isBusy, setBusy }
}
