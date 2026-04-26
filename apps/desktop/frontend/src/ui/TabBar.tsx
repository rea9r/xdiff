import { IconPlus, IconX } from '@tabler/icons-react'
import { Menu, Tooltip } from '@mantine/core'
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { DesktopTab } from '../useDesktopTabsManager'
import { useTabDirtySnapshot } from '../useDesktopTabDirtyRegistry'

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
const NEW_TAB_SHORTCUT = isMac ? '⌘T' : 'Ctrl+T'

type TabBarProps = {
  tabs: DesktopTab[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onAddTab: () => void
  onCloseTab: (id: string) => void
  onCloseOthers: (id: string) => void
  onCloseToRight: (id: string) => void
  onCloseAll: () => void
  onReorderTab: (fromId: string, toId: string) => void
}

const TAB_ID_ATTR = 'data-tab-id'
const DRAG_THRESHOLD = 4

function findTabIdAtPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y)
  if (!el) return null
  const tab = (el as Element).closest(`[${TAB_ID_ATTR}]`)
  return tab?.getAttribute(TAB_ID_ATTR) ?? null
}

export function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  onReorderTab,
}: TabBarProps) {
  const canClose = tabs.length > 1
  const { isTabDirty } = useTabDirtySnapshot()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const startRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const onReorderRef = useRef(onReorderTab)
  onReorderRef.current = onReorderTab
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const active = scroll.querySelector<HTMLElement>(`[${TAB_ID_ATTR}="${CSS.escape(activeTabId)}"]`)
    if (!active) return
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeTabId, tabs])

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const scroll = scrollRef.current
    if (!scroll) return
    if (event.deltaX !== 0) return
    if (event.deltaY === 0) return
    scroll.scrollLeft += event.deltaY
  }

  const lastEmptyClickRef = useRef<number>(0)
  const handleScrollMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.button !== 0) return
    event.preventDefault()
    const now = performance.now()
    if (now - lastEmptyClickRef.current < 350) {
      onAddTab()
      lastEmptyClickRef.current = 0
      return
    }
    lastEmptyClickRef.current = now
  }

  const closeMenu = () => setMenu(null)
  const menuTabIndex = menu ? tabs.findIndex((t) => t.id === menu.tabId) : -1
  const isMenuTabLast = menuTabIndex >= 0 && menuTabIndex === tabs.length - 1

  useEffect(() => {
    const setBodyDragging = (active: boolean) => {
      document.body.classList.toggle('xdiff-tab-dragging', active)
    }
    const handleMove = (event: PointerEvent) => {
      const start = startRef.current
      if (!start) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (!draggingRef.current && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
        draggingRef.current = true
        setBodyDragging(true)
        setDragId(start.id)
      }
      if (!draggingRef.current) return
      const targetId = findTabIdAtPoint(event.clientX, event.clientY)
      setOverId(targetId && targetId !== start.id ? targetId : null)
    }
    const handleUp = (event: PointerEvent) => {
      const start = startRef.current
      if (!start) return
      const wasDragging = draggingRef.current
      const targetId = findTabIdAtPoint(event.clientX, event.clientY)
      startRef.current = null
      draggingRef.current = false
      setBodyDragging(false)
      setDragId(null)
      setOverId(null)
      if (wasDragging) {
        suppressClickRef.current = true
        if (targetId && targetId !== start.id) {
          onReorderRef.current(start.id, targetId)
        }
        setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
    }
    const handleCancel = () => {
      startRef.current = null
      draggingRef.current = false
      setBodyDragging(false)
      setDragId(null)
      setOverId(null)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
    }
  }, [])

  return (
    <>
    <div className="xdiff-tab-bar">
      <div
        className="xdiff-tab-bar-scroll"
        role="tablist"
        ref={scrollRef}
        onWheel={handleWheel}
        onMouseDown={handleScrollMouseDown}
      >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const isDragging = tab.id === dragId
        const isDragOver = tab.id === overId && dragId !== null && dragId !== tab.id
        const isDirty = isTabDirty(tab.id)

        const handleClose = (event: ReactMouseEvent<HTMLButtonElement>) => {
          event.stopPropagation()
          onCloseTab(tab.id)
        }

        const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
          if (event.button !== 0) return
          if ((event.target as Element).closest('.xdiff-tab-close')) return
          event.preventDefault()
          startRef.current = { id: tab.id, x: event.clientX, y: event.clientY }
          draggingRef.current = false
        }

        const handleClick = () => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          onSelectTab(tab.id)
        }

        const handleAuxClick = (event: ReactMouseEvent<HTMLDivElement>) => {
          if (event.button !== 1) return
          event.preventDefault()
          if (canClose) onCloseTab(tab.id)
        }

        const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
          event.preventDefault()
          window.getSelection()?.removeAllRanges()
          setMenu({ tabId: tab.id, x: event.clientX, y: event.clientY })
        }

        const className = [
          'xdiff-tab',
          isActive ? 'is-active' : '',
          isDragging ? 'is-dragging' : '',
          isDragOver ? 'is-drag-over' : '',
          isDirty ? 'is-dirty' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={isActive}
            className={className}
            data-tab-id={tab.id}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            onAuxClick={handleAuxClick}
            onContextMenu={handleContextMenu}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectTab(tab.id)
              }
            }}
          >
            <span className="xdiff-tab-label">{tab.label}</span>
            {canClose ? (
              <span className="xdiff-tab-end-slot">
                <button
                  type="button"
                  className="xdiff-tab-close"
                  onClick={handleClose}
                  aria-label={`Close ${tab.label}`}
                >
                  <IconX size={12} />
                </button>
                {isDirty ? (
                  <span className="xdiff-tab-dirty-dot" aria-hidden="true" />
                ) : null}
              </span>
            ) : isDirty ? (
              <span className="xdiff-tab-end-slot">
                <span className="xdiff-tab-dirty-dot" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        )
      })}
      </div>
      <Tooltip label={`New tab (${NEW_TAB_SHORTCUT})`} withArrow position="bottom">
        <button
          type="button"
          className="xdiff-tab-add"
          onClick={onAddTab}
          onMouseDown={(event) => event.preventDefault()}
          tabIndex={-1}
          aria-label="New tab"
        >
          <IconPlus size={14} />
        </button>
      </Tooltip>
    </div>
    <Menu
      opened={menu !== null}
      onClose={closeMenu}
      position="bottom-start"
      withinPortal
      shadow="md"
      closeOnItemClick
    >
      <Menu.Target>
        <div
          style={{
            position: 'fixed',
            left: menu?.x ?? 0,
            top: menu?.y ?? 0,
            width: 0,
            height: 0,
          }}
        />
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          disabled={tabs.length <= 1}
          onClick={() => {
            if (menu) onCloseOthers(menu.tabId)
          }}
        >
          Close others
        </Menu.Item>
        <Menu.Item
          disabled={isMenuTabLast || tabs.length <= 1}
          onClick={() => {
            if (menu) onCloseToRight(menu.tabId)
          }}
        >
          Close to the right
        </Menu.Item>
        <Menu.Item onClick={onCloseAll}>Close all</Menu.Item>
      </Menu.Dropdown>
    </Menu>
    </>
  )
}
