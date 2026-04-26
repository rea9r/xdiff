import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { useDesktopAppModel } from './useDesktopAppModel'

export type DesktopTabSlots = ReturnType<typeof useDesktopAppModel>

const ActiveSlotsContext = createContext<DesktopTabSlots | null>(null)
const PublishSlotsContext = createContext<((slots: DesktopTabSlots) => void) | null>(null)

export function DesktopTabSlotsProvider({ children }: { children: ReactNode }) {
  const [activeSlots, setActiveSlots] = useState<DesktopTabSlots | null>(null)
  const publish = useCallback((slots: DesktopTabSlots) => {
    setActiveSlots(slots)
  }, [])

  return (
    <PublishSlotsContext.Provider value={publish}>
      <ActiveSlotsContext.Provider value={activeSlots}>
        {children}
      </ActiveSlotsContext.Provider>
    </PublishSlotsContext.Provider>
  )
}

export function useActiveDesktopTabSlots(): DesktopTabSlots | null {
  return useContext(ActiveSlotsContext)
}

export function usePublishDesktopTabSlots(): (slots: DesktopTabSlots) => void {
  const publish = useContext(PublishSlotsContext)
  if (!publish) {
    throw new Error('usePublishDesktopTabSlots must be used within DesktopTabSlotsProvider')
  }
  return publish
}
