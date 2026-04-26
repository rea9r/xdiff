import './style.css'
import { AppChrome } from './ui/AppChrome'
import { TabBar } from './ui/TabBar'
import { useDesktopAppModel } from './useDesktopAppModel'
import { useDesktopBridge } from './useDesktopBridge'
import { useDesktopRecentPairs } from './useDesktopRecentPairs'
import { useDesktopTabsManager } from './useDesktopTabsManager'

export function App() {
  const api = useDesktopBridge()
  const recentPairs = useDesktopRecentPairs()
  const { tabs, activeTabId } = useDesktopTabsManager()

  const {
    mode,
    onModeChange,
    layoutMode,
    sidebar,
    headerActions,
    main,
    inspector,
    inspectorOpen,
  } = useDesktopAppModel({ api, recentPairs })

  return (
    <AppChrome
      mode={mode}
      onModeChange={onModeChange}
      layoutMode={layoutMode}
      sidebar={sidebar}
      headerActions={headerActions}
      main={main}
      inspector={inspector}
      inspectorOpen={inspectorOpen}
      tabBar={<TabBar tabs={tabs} activeTabId={activeTabId} />}
    />
  )
}
