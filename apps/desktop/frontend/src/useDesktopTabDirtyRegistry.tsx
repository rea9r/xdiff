import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type DirtyMutator = {
  setTabDirty: (tabId: string, isDirty: boolean) => void
}

type DirtySnapshot = {
  isTabDirty: (tabId: string) => boolean
  dirtyTabIdsAmong: (ids: string[]) => string[]
}

const NO_OP_MUTATOR: DirtyMutator = { setTabDirty: () => {} }
const EMPTY_SNAPSHOT: DirtySnapshot = {
  isTabDirty: () => false,
  dirtyTabIdsAmong: () => [],
}

const DirtyMutatorContext = createContext<DirtyMutator>(NO_OP_MUTATOR)
const DirtySnapshotContext = createContext<DirtySnapshot>(EMPTY_SNAPSHOT)

export function DesktopTabDirtyProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState<ReadonlySet<string>>(() => new Set())

  const setTabDirty = useCallback((tabId: string, isDirty: boolean) => {
    setDirty((prev) => {
      const has = prev.has(tabId)
      if (isDirty === has) return prev
      const next = new Set(prev)
      if (isDirty) next.add(tabId)
      else next.delete(tabId)
      return next
    })
  }, [])

  const mutator = useMemo<DirtyMutator>(() => ({ setTabDirty }), [setTabDirty])
  const snapshot = useMemo<DirtySnapshot>(
    () => ({
      isTabDirty: (id) => dirty.has(id),
      dirtyTabIdsAmong: (ids) => ids.filter((id) => dirty.has(id)),
    }),
    [dirty],
  )

  return (
    <DirtyMutatorContext.Provider value={mutator}>
      <DirtySnapshotContext.Provider value={snapshot}>{children}</DirtySnapshotContext.Provider>
    </DirtyMutatorContext.Provider>
  )
}

export function useTabDirtyMutator(): DirtyMutator {
  return useContext(DirtyMutatorContext)
}

export function useTabDirtySnapshot(): DirtySnapshot {
  return useContext(DirtySnapshotContext)
}
