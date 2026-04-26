import { useState } from 'react'

export type DesktopTab = {
  id: string
  label: string
}

const INITIAL_TAB: DesktopTab = { id: 'tab-1', label: 'Tab 1' }

export function useDesktopTabsManager() {
  const [tabs] = useState<DesktopTab[]>([INITIAL_TAB])
  const [activeTabId] = useState<string>(INITIAL_TAB.id)
  return { tabs, activeTabId }
}

export type DesktopTabsManagerState = ReturnType<typeof useDesktopTabsManager>
