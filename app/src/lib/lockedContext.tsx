import { createContext, useContext, type ReactNode } from 'react'

// Reemplaza el patrón legado `.proyecto-card.locked input,...{pointer-events:none}`
// (solo visual) por un `disabled` real de React que además bloquea foco/teclado.
const LockedContext = createContext(false)

export function LockedProvider({ locked, children }: { locked: boolean; children: ReactNode }) {
  return <LockedContext.Provider value={locked}>{children}</LockedContext.Provider>
}

export function useLocked() {
  return useContext(LockedContext)
}
