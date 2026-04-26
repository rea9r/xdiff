import { useEffect, useRef } from 'react'
import type { DesktopTabsManagerState } from './useDesktopTabsManager'

export function useDesktopTabHotkeys(tabsManager: DesktopTabsManagerState) {
  const managerRef = useRef(tabsManager)
  managerRef.current = tabsManager

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const ctrlOrCmd = event.ctrlKey || event.metaKey
      if (!ctrlOrCmd || event.altKey || event.shiftKey) {
        return
      }

      const m = managerRef.current
      const key = event.key.toLowerCase()

      if (key === 't') {
        event.preventDefault()
        m.addTab()
        return
      }

      if (key === 'w') {
        event.preventDefault()
        m.closeTab(m.activeTabId)
        return
      }

      if (/^[1-9]$/.test(event.key)) {
        const n = Number(event.key)
        const target = n === 9 ? m.tabs[m.tabs.length - 1] : m.tabs[n - 1]
        if (target) {
          event.preventDefault()
          m.setActiveTabId(target.id)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
