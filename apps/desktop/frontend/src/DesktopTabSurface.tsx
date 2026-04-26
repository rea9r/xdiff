import { useLayoutEffect } from 'react'
import { useDesktopAppModel } from './useDesktopAppModel'
import { usePublishDesktopTabSlots } from './useDesktopTabSlotsContext'
import type { useDesktopBridge } from './useDesktopBridge'
import type { DesktopRecentPairsState } from './useDesktopRecentPairs'

type DesktopTabSurfaceProps = {
  isActive: boolean
  api: ReturnType<typeof useDesktopBridge>
  recentPairs: DesktopRecentPairsState
}

export function DesktopTabSurface({ isActive, api, recentPairs }: DesktopTabSurfaceProps) {
  const slots = useDesktopAppModel({ api, recentPairs, enabled: isActive })
  const publish = usePublishDesktopTabSlots()

  // useLayoutEffect so the active tab's slots are published before paint,
  // avoiding a flash of empty chrome on first mount or tab switch.
  useLayoutEffect(() => {
    if (isActive) {
      publish(slots)
    }
  }, [isActive, slots, publish])

  return null
}
