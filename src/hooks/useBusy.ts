import { createContext, useContext } from 'react'

interface BusyState {
  isBusy: boolean
  setBusy: (busy: boolean) => void
}

export const BusyContext = createContext<BusyState>({ isBusy: false, setBusy: () => {} })

export function useBusy() {
  return useContext(BusyContext)
}
