import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { DesktopTabSession } from '../../types'
import { commitTabUpdate } from '../../useDesktopPersistence'
import type { DesktopStatePersistor } from '../../useDesktopStatePersistor'

type StateSetter<T> = Dispatch<SetStateAction<T>>

type UseDirectoryPersistenceOptions = {
  initialDirectorySession: DesktopTabSession['directory']
  tabId: string
  commit: DesktopStatePersistor['commit']
  leftRoot: string
  rightRoot: string
  currentPath: string
  viewMode: DesktopTabSession['directory']['viewMode']
  setLeftRoot: StateSetter<string>
  setRightRoot: StateSetter<string>
  setCurrentPath: StateSetter<string>
  setViewMode: StateSetter<DesktopTabSession['directory']['viewMode']>
}

export function useDirectoryPersistence({
  initialDirectorySession,
  tabId,
  commit,
  leftRoot,
  rightRoot,
  currentPath,
  viewMode,
  setLeftRoot,
  setRightRoot,
  setCurrentPath,
  setViewMode,
}: UseDirectoryPersistenceOptions) {
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current) {
      return
    }

    try {
      setLeftRoot(initialDirectorySession.leftRoot || '')
      setRightRoot(initialDirectorySession.rightRoot || '')
      setCurrentPath(initialDirectorySession.currentPath || '')
      setViewMode(initialDirectorySession.viewMode === 'tree' ? 'tree' : 'list')
    } catch {
      // keep app usable even when hydration fails
    } finally {
      hydratedRef.current = true
    }
  }, [
    initialDirectorySession,
    setCurrentPath,
    setLeftRoot,
    setRightRoot,
    setViewMode,
  ])

  useEffect(() => {
    if (!hydratedRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      commitTabUpdate(commit, tabId, (session) => ({
        ...session,
        directory: {
          leftRoot,
          rightRoot,
          currentPath,
          viewMode,
        },
      }))
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [commit, tabId, leftRoot, rightRoot, currentPath, viewMode])
}
