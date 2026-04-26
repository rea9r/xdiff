import { IconPlus, IconX } from '@tabler/icons-react'
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { DesktopTab } from '../useDesktopTabsManager'

type TabBarProps = {
  tabs: DesktopTab[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onAddTab: () => void
  onCloseTab: (id: string) => void
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
  onReorderTab,
}: TabBarProps) {
  const canClose = tabs.length > 1
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const startRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const onReorderRef = useRef(onReorderTab)
  onReorderRef.current = onReorderTab

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
    <div className="xdiff-tab-bar" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const isDragging = tab.id === dragId
        const isDragOver = tab.id === overId && dragId !== null && dragId !== tab.id

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

        const className = [
          'xdiff-tab',
          isActive ? 'is-active' : '',
          isDragging ? 'is-dragging' : '',
          isDragOver ? 'is-drag-over' : '',
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
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectTab(tab.id)
              }
            }}
          >
            <span className="xdiff-tab-label">{tab.label}</span>
            {canClose ? (
              <button
                type="button"
                className="xdiff-tab-close"
                onClick={handleClose}
                aria-label={`Close ${tab.label}`}
              >
                <IconX size={12} />
              </button>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        className="xdiff-tab-add"
        onClick={onAddTab}
        aria-label="New tab"
      >
        <IconPlus size={14} />
      </button>
    </div>
  )
}
