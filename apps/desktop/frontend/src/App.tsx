import './style.css'
import { useMemo } from 'react'
import { AppChrome } from './ui/AppChrome'
import { TabBar } from './ui/TabBar'
import { DesktopTabSurface } from './DesktopTabSurface'
import {
  DesktopTabSlotsProvider,
  useActiveDesktopTabSlots,
} from './useDesktopTabSlotsContext'
import { useDesktopBridge } from './useDesktopBridge'
import { useDesktopRecentPairs } from './useDesktopRecentPairs'
import {
  useDesktopTabsManager,
  type DesktopTabsManagerState,
} from './useDesktopTabsManager'
import { useDesktopStatePersistor } from './useDesktopStatePersistor'
import { useDesktopTabHotkeys } from './useDesktopTabHotkeys'
import type { DesktopState, DesktopTabSession } from './types'

export function App() {
  const api = useDesktopBridge()
  const persistor = useDesktopStatePersistor({ api })

  if (!persistor.hydrated || !persistor.snapshot) {
    return null
  }

  return <AppHydrated api={api} persistor={persistor} initial={persistor.snapshot} />
}

type AppHydratedProps = {
  api: ReturnType<typeof useDesktopBridge>
  persistor: ReturnType<typeof useDesktopStatePersistor>
  initial: DesktopState
}

function AppHydrated({ api, persistor, initial }: AppHydratedProps) {
  const recentPairs = useDesktopRecentPairs({ initial, commit: persistor.commit })
  const tabsManager = useDesktopTabsManager({
    initial,
    commit: persistor.commit,
    fallbackTabSession: persistor.fallbackTabSession,
  })
  useDesktopTabHotkeys(tabsManager)

  const initialSessionsById = useMemo(() => {
    const map = new Map<string, DesktopTabSession>()
    for (const session of initial.tabs) {
      map.set(session.id, session)
    }
    return map
  }, [initial])

  return (
    <DesktopTabSlotsProvider>
      <ActiveTabAppChrome tabsManager={tabsManager} />
      {tabsManager.tabs.map((tab) => {
        const initialSession =
          initialSessionsById.get(tab.id) ??
          persistor.getLatestSession(tab.id) ??
          persistor.fallbackTabSession(tab.id, tab.label)
        return (
          <DesktopTabSurface
            key={tab.id}
            tabId={tab.id}
            isActive={tab.id === tabsManager.activeTabId}
            api={api}
            recentPairs={recentPairs}
            onLabelChange={tabsManager.updateTabLabel}
            initialSession={initialSession}
            commit={persistor.commit}
          />
        )
      })}
    </DesktopTabSlotsProvider>
  )
}

function ActiveTabAppChrome({ tabsManager }: { tabsManager: DesktopTabsManagerState }) {
  const slots = useActiveDesktopTabSlots()
  const { tabs, activeTabId, setActiveTabId, addTab, closeTab, reorderTab } = tabsManager

  if (!slots) {
    return null
  }

  return (
    <AppChrome
      mode={slots.mode}
      onModeChange={slots.onModeChange}
      layoutMode={slots.layoutMode}
      sidebar={slots.sidebar}
      headerActions={slots.headerActions}
      main={slots.main}
      inspector={slots.inspector}
      inspectorOpen={slots.inspectorOpen}
      tabBar={
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onAddTab={addTab}
          onCloseTab={closeTab}
          onReorderTab={reorderTab}
        />
      }
    />
  )
}
