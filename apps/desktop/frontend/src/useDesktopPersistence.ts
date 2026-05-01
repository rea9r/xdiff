import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type {
  DesktopState,
  DesktopTabSession,
  LoadTextFileRequest,
  LoadTextFileResponse,
  Mode,
} from './types'
import { useJSONPersistence } from './features/json/useJSONPersistence'
import { useTextPersistence } from './features/text/useTextPersistence'
import { useDirectoryPersistence } from './features/directory/useDirectoryPersistence'
import type { DesktopStatePersistor } from './useDesktopStatePersistor'

type StateSetter<T> = Dispatch<SetStateAction<T>>

export type LoadTextFileFn = (req: LoadTextFileRequest) => Promise<LoadTextFileResponse>

export function commitTabUpdate(
  commit: DesktopStatePersistor['commit'],
  tabId: string,
  updater: (session: DesktopTabSession) => DesktopTabSession,
): void {
  commit((prev) => {
    const idx = prev.tabs.findIndex((t) => t.id === tabId)
    if (idx < 0) {
      return prev
    }
    const newTabs = [...prev.tabs]
    newTabs[idx] = updater(prev.tabs[idx])
    return { ...prev, tabs: newTabs }
  })
}

export async function safeLoadText(
  loadTextFile: LoadTextFileFn | undefined,
  path: string,
): Promise<string> {
  if (!loadTextFile) {
    return ''
  }
  const trimmed = path.trim()
  if (!trimmed) {
    return ''
  }
  try {
    const loaded: LoadTextFileResponse = await loadTextFile({
      path: trimmed,
    } satisfies LoadTextFileRequest)
    return loaded.content
  } catch {
    return ''
  }
}

type UseDesktopPersistenceOptions = {
  initialSession: DesktopTabSession
  tabId: string
  commit: DesktopStatePersistor['commit']
  loadTextFile?: LoadTextFileFn
  mode: Mode
  setMode: StateSetter<Mode>
  json: {
    oldSourcePath: string
    newSourcePath: string
    ignoreOrder: boolean
    common: DesktopState['tabs'][number]['json']['common']
    setIgnoreOrder: StateSetter<boolean>
    setCommon: StateSetter<DesktopState['tabs'][number]['json']['common']>
    setIgnorePathsDraft: StateSetter<string>
    setOldSourcePath: StateSetter<string>
    setNewSourcePath: StateSetter<string>
    setOldText: StateSetter<string>
    setNewText: StateSetter<string>
  }
  text: {
    oldSourcePath: string
    newSourcePath: string
    common: DesktopState['tabs'][number]['text']['common']
    diffLayout: DesktopState['tabs'][number]['text']['diffLayout']
    setCommon: StateSetter<DesktopState['tabs'][number]['text']['common']>
    setDiffLayout: StateSetter<DesktopState['tabs'][number]['text']['diffLayout']>
    setOldSourcePath: StateSetter<string>
    setNewSourcePath: StateSetter<string>
    setOldText: StateSetter<string>
    setNewText: StateSetter<string>
  }
  directory: {
    leftRoot: string
    rightRoot: string
    currentPath: string
    viewMode: DesktopState['tabs'][number]['directory']['viewMode']
    setLeftRoot: StateSetter<string>
    setRightRoot: StateSetter<string>
    setCurrentPath: StateSetter<string>
    setViewMode: StateSetter<DesktopState['tabs'][number]['directory']['viewMode']>
  }
}

const APP_MODES: Mode[] = ['text', 'json', 'directory']

function isMode(value: string): value is Mode {
  return APP_MODES.includes(value as Mode)
}

export function useDesktopPersistence({
  initialSession,
  tabId,
  commit,
  loadTextFile,
  mode,
  setMode,
  json,
  text,
  directory,
}: UseDesktopPersistenceOptions) {
  const hydratedModeRef = useRef(false)

  useEffect(() => {
    if (hydratedModeRef.current) {
      return
    }
    if (isMode(initialSession.lastUsedMode)) {
      setMode(initialSession.lastUsedMode)
    }
    hydratedModeRef.current = true
  }, [initialSession, setMode])

  useEffect(() => {
    if (!hydratedModeRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      commitTabUpdate(commit, tabId, (session) => ({
        ...session,
        lastUsedMode: mode,
      }))
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [commit, tabId, mode])

  useJSONPersistence({
    initialJSONSession: initialSession.json,
    tabId,
    commit,
    loadTextFile,
    ...json,
  })

  useTextPersistence({
    initialTextSession: initialSession.text,
    tabId,
    commit,
    loadTextFile,
    ...text,
  })

  useDirectoryPersistence({
    initialDirectorySession: initialSession.directory,
    tabId,
    commit,
    ...directory,
  })
}
