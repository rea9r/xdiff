import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesktopState, DesktopTabSession, Mode } from './types'
import type { useDesktopBridge } from './useDesktopBridge'

const SAVE_DEBOUNCE_MS = 500
const FALLBACK_TAB_ID = 'tab-1'
const FALLBACK_TAB_LABEL = 'Tab 1'

function fallbackTabSession(id: string, label: string): DesktopTabSession {
  return {
    id,
    label,
    lastUsedMode: 'json' as Mode,
    json: {
      oldSourcePath: '',
      newSourcePath: '',
      ignoreOrder: false,
      common: {
        outputFormat: 'text',
        textStyle: 'auto',
        ignorePaths: [],
        showPaths: false,
        ignoreWhitespace: false,
        ignoreCase: false,
        ignoreEOL: false,
      },
    },
    text: {
      oldSourcePath: '',
      newSourcePath: '',
      common: {
        outputFormat: 'text',
        textStyle: 'auto',
        ignorePaths: [],
        showPaths: false,
        ignoreWhitespace: false,
        ignoreCase: false,
        ignoreEOL: false,
      },
      diffLayout: 'split',
    },
    directory: {
      leftRoot: '',
      rightRoot: '',
      currentPath: '',
      viewMode: 'list',
    },
  }
}

function fallbackDesktopState(): DesktopState {
  return {
    version: 3,
    tabs: [fallbackTabSession(FALLBACK_TAB_ID, FALLBACK_TAB_LABEL)],
    activeTabId: FALLBACK_TAB_ID,
    jsonRecentPairs: [],
    textRecentPairs: [],
    directoryRecentPairs: [],
  }
}

export type DesktopStatePersistor = {
  hydrated: boolean
  snapshot: DesktopState | null
  commit: (updater: (prev: DesktopState) => DesktopState) => void
  fallbackTabSession: (id: string, label: string) => DesktopTabSession
}

export function useDesktopStatePersistor({
  api,
}: {
  api: ReturnType<typeof useDesktopBridge>
}): DesktopStatePersistor {
  const [hydrated, setHydrated] = useState(false)
  const [snapshot, setSnapshot] = useState<DesktopState | null>(null)
  const stateRef = useRef<DesktopState | null>(null)
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const finish = (loaded: DesktopState) => {
      if (cancelled) {
        return
      }
      stateRef.current = loaded
      setSnapshot(loaded)
      setHydrated(true)
    }

    api.loadDesktopState()
      .then((loaded) => {
        if (loaded && Array.isArray(loaded.tabs) && loaded.tabs.length > 0) {
          finish(loaded)
        } else {
          finish(fallbackDesktopState())
        }
      })
      .catch(() => {
        finish(fallbackDesktopState())
      })

    return () => {
      cancelled = true
    }
  }, [api])

  const commit = useCallback(
    (updater: (prev: DesktopState) => DesktopState) => {
      const current = stateRef.current
      if (!current) {
        return
      }
      const next = updater(current)
      if (next === current) {
        return
      }
      stateRef.current = next

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null
        const latest = stateRef.current
        if (!latest) {
          return
        }
        void api.saveDesktopState(latest).catch(() => {
          // keep save errors non-fatal
        })
      }, SAVE_DEBOUNCE_MS)
    },
    [api],
  )

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }
    },
    [],
  )

  return {
    hydrated,
    snapshot,
    commit,
    fallbackTabSession,
  }
}
