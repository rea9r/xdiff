import type { DesktopTab } from '../useDesktopTabsManager'

type TabBarProps = {
  tabs: DesktopTab[]
  activeTabId: string
}

export function TabBar({ tabs, activeTabId }: TabBarProps) {
  return (
    <div className="xdiff-tab-bar" role="tablist">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTabId}
          className={`xdiff-tab ${tab.id === activeTabId ? 'is-active' : ''}`}
        >
          <span className="xdiff-tab-label">{tab.label}</span>
        </div>
      ))}
    </div>
  )
}
