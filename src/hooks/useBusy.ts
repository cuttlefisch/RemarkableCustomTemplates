import { createContext, useContext } from 'react'

/** Global busy/loading state shared across components via context. */
interface BusyState {
  isBusy: boolean
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
