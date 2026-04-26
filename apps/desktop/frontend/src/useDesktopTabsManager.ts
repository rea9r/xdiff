import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesktopState, DesktopTabSession } from './types'
import type { DesktopStatePersistor } from './useDesktopStatePersistor'

export type DesktopTab = {
  id: string
  label: string
}

export type UseDesktopTabsManagerOptions = {
  initial: DesktopState
  commit: DesktopStatePersistor['commit']
  fallbackTabSession: DesktopStatePersistor['fallbackTabSession']
}

export function useDesktopTabsManager({
  initial,
  commit,
  fallbackTabSession,
}: UseDesktopTabsManagerOptions) {
  const initialTabsRef = useRef<DesktopTab[]>(
    initial.tabs.map((t) => ({ id: t.id, label: t.label })),
  )
  const initialActiveTabIdRef = useRef<string>(initial.activeTabId)

  const [tabs, setTabs] = useState<DesktopTab[]>(initialTabsRef.current)
  const [activeTabId, setActiveTabId] = useState<string>(initialActiveTabIdRef.current)
  const counterRef = useRef<number>(initialTabsRef.current.length)

  const addTab = useCallback(() => {
    counterRef.current += 1
    const next = counterRef.current
    const id = `tab-${next}-${Date.now()}`
    const label = `Tab ${next}`
    const newTab: DesktopTab = { id, label }
    commit((prev) => {
      const sourceSession = prev.tabs.find((t) => t.id === prev.activeTabId)
      const fresh = fallbackTabSession(id, label)
      const newSession = sourceSession
        ? { ...fresh, lastUsedMode: sourceSession.lastUsedMode }
        : fresh
      return { ...prev, tabs: [...prev.tabs, newSession] }
    })
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(id)
  }, [commit, fallbackTabSession])

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t.id !== id)))
  }, [])

  const updateTabLabel = useCallback((id: string, label: string) => {
    setTabs((prev) => {
      const target = prev.find((t) => t.id === id)
      if (!target || target.label === label) {
        return prev
      }
      return prev.map((t) => (t.id === id ? { ...t, label } : t))
    })
  }, [])

  const reorderTab = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) {
      return
    }
    setTabs((prev) => {
      const fromIdx = prev.findIndex((t) => t.id === fromId)
      const toIdx = prev.findIndex((t) => t.id === toId)
      if (fromIdx < 0 || toIdx < 0) {
        return prev
      }
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }, [])

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id)
    }
  }, [tabs, activeTabId])

  const isFirstSyncRef = useRef(true)
  useEffect(() => {
    if (isFirstSyncRef.current) {
      isFirstSyncRef.current = false
      return
    }
    commit((prev) => {
      const newSessions: DesktopTabSession[] = tabs.map((t) => {
        const existing = prev.tabs.find((s) => s.id === t.id)
        if (existing) {
          return existing.label === t.label ? existing : { ...existing, label: t.label }
        }
        return fallbackTabSession(t.id, t.label)
      })
      return { ...prev, tabs: newSessions, activeTabId }
    })
  }, [tabs, activeTabId, commit, fallbackTabSession])

  return {
    tabs,
    activeTabId,
    setActiveTabId,
    addTab,
    closeTab,
    updateTabLabel,
    reorderTab,
  }
}

export type DesktopTabsManagerState = ReturnType<typeof useDesktopTabsManager>
