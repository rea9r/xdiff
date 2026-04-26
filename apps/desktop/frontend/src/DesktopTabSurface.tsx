import { useEffect, useLayoutEffect } from 'react'
import { useDesktopAppModel } from './useDesktopAppModel'
import { usePublishDesktopTabSlots } from './useDesktopTabSlotsContext'
import type { useDesktopBridge } from './useDesktopBridge'
import type { DesktopRecentPairsState } from './useDesktopRecentPairs'
import type { DesktopTabSession } from './types'
import type { DesktopStatePersistor } from './useDesktopStatePersistor'

type DesktopTabSurfaceProps = {
  tabId: string
  isActive: boolean
  api: ReturnType<typeof useDesktopBridge>
  recentPairs: DesktopRecentPairsState
  onLabelChange: (id: string, label: string) => void
  initialSession: DesktopTabSession
  commit: DesktopStatePersistor['commit']
}

export function DesktopTabSurface({
  tabId,
  isActive,
  api,
  recentPairs,
  onLabelChange,
  initialSession,
  commit,
}: DesktopTabSurfaceProps) {
  const slots = useDesktopAppModel({
    api,
    recentPairs,
    initialSession,
    tabId,
    commit,
  })
  const publish = usePublishDesktopTabSlots()

  // useLayoutEffect so the active tab's slots are published before paint,
  // avoiding a flash of empty chrome on first mount or tab switch.
  useLayoutEffect(() => {
    if (isActive) {
      publish(slots)
    }
  }, [isActive, slots, publish])

  useEffect(() => {
    if (slots.tabLabel) {
      onLabelChange(tabId, slots.tabLabel)
    }
  }, [tabId, slots.tabLabel, onLabelChange])

  return null
}
