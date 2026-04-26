import { useCallback, useRef } from 'react'
import { useTabDirtySnapshot } from './useDesktopTabDirtyRegistry'
import type { DesktopTabsManagerState } from './useDesktopTabsManager'

type ConfirmFn = (dirtyCount: number) => Promise<boolean>

export type GuardedTabClose = {
  closeTab: (id: string) => void
  closeOthers: (keepId: string) => void
  closeToRight: (id: string) => void
  closeAll: () => void
}

export function useGuardedTabClose(
  tabsManager: DesktopTabsManagerState,
  confirm: ConfirmFn,
): GuardedTabClose {
  const { dirtyTabIdsAmong } = useTabDirtySnapshot()
  const managerRef = useRef(tabsManager)
  managerRef.current = tabsManager

  const closeTab = useCallback(
    async (id: string) => {
      const m = managerRef.current
      const dirty = dirtyTabIdsAmong([id])
      if (dirty.length === 0) {
        m.closeTab(id)
        return
      }
      const ok = await confirm(dirty.length)
      if (ok) m.closeTab(id)
    },
    [dirtyTabIdsAmong, confirm],
  )

  const closeOthers = useCallback(
    async (keepId: string) => {
      const m = managerRef.current
      const others = m.tabs.filter((t) => t.id !== keepId).map((t) => t.id)
      const dirty = dirtyTabIdsAmong(others)
      if (dirty.length === 0) {
        m.closeOthers(keepId)
        return
      }
      const ok = await confirm(dirty.length)
      if (ok) m.closeOthers(keepId)
    },
    [dirtyTabIdsAmong, confirm],
  )

  const closeToRight = useCallback(
    async (id: string) => {
      const m = managerRef.current
      const idx = m.tabs.findIndex((t) => t.id === id)
      if (idx < 0) return
      const toClose = m.tabs.slice(idx + 1).map((t) => t.id)
      const dirty = dirtyTabIdsAmong(toClose)
      if (dirty.length === 0) {
        m.closeToRight(id)
        return
      }
      const ok = await confirm(dirty.length)
      if (ok) m.closeToRight(id)
    },
    [dirtyTabIdsAmong, confirm],
  )

  const closeAll = useCallback(async () => {
    const m = managerRef.current
    const ids = m.tabs.map((t) => t.id)
    const dirty = dirtyTabIdsAmong(ids)
    if (dirty.length === 0) {
      m.closeAll()
      return
    }
    const ok = await confirm(dirty.length)
    if (ok) m.closeAll()
  }, [dirtyTabIdsAmong, confirm])

  return { closeTab, closeOthers, closeToRight, closeAll }
}
