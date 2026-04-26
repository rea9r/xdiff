import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type {
  DesktopState,
  DesktopTabSession,
  LoadTextFileRequest,
  LoadTextFileResponse,
  Mode,
} from './types'
import { ignorePathsToText } from './utils/appHelpers'
import { defaultJSONCommon, defaultTextCommon } from './useDesktopModeState'
import type { DesktopStatePersistor } from './useDesktopStatePersistor'

type StateSetter<T> = Dispatch<SetStateAction<T>>

type LoadTextFileFn = (req: LoadTextFileRequest) => Promise<LoadTextFileResponse>

type UseDesktopPersistenceOptions = {
  enabled?: boolean
  initialSession: DesktopTabSession
  initialTabId: string
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
  enabled = true,
  initialSession,
  initialTabId,
  commit,
  loadTextFile,
  mode,
  setMode,
  json,
  text,
  directory,
}: UseDesktopPersistenceOptions) {
  const hydratedRef = useRef(false)

  const {
    oldSourcePath: jsonOldSourcePath,
    newSourcePath: jsonNewSourcePath,
    ignoreOrder,
    common: jsonCommon,
    setIgnoreOrder,
    setCommon: setJSONCommon,
    setIgnorePathsDraft: setJSONIgnorePathsDraft,
    setOldSourcePath: setJSONOldSourcePath,
    setNewSourcePath: setJSONNewSourcePath,
    setOldText: setJSONOldText,
    setNewText: setJSONNewText,
  } = json

  const {
    oldSourcePath: textOldSourcePath,
    newSourcePath: textNewSourcePath,
    common: textCommon,
    diffLayout: textDiffLayout,
    setCommon: setTextCommon,
    setDiffLayout: setTextDiffLayout,
    setOldSourcePath: setTextOldSourcePath,
    setNewSourcePath: setTextNewSourcePath,
    setOldText: setTextOld,
    setNewText: setTextNew,
  } = text

  const {
    leftRoot: directoryLeftRoot,
    rightRoot: directoryRightRoot,
    currentPath: directoryCurrentPath,
    viewMode: directoryViewMode,
    setLeftRoot: setDirectoryLeftRoot,
    setRightRoot: setDirectoryRightRoot,
    setCurrentPath: setDirectoryCurrentPath,
    setViewMode: setDirectoryViewMode,
  } = directory

  useEffect(() => {
    if (!enabled || hydratedRef.current) {
      return
    }

    let active = true

    const hydrate = async () => {
      try {
        if (isMode(initialSession.lastUsedMode)) {
          setMode(initialSession.lastUsedMode)
        }

        setIgnoreOrder(!!initialSession.json.ignoreOrder)
        const mergedJSONCommon = { ...defaultJSONCommon, ...initialSession.json.common }
        setJSONCommon(mergedJSONCommon)
        setJSONIgnorePathsDraft(ignorePathsToText(mergedJSONCommon.ignorePaths))
        setJSONOldSourcePath(initialSession.json.oldSourcePath || '')
        setJSONNewSourcePath(initialSession.json.newSourcePath || '')

        setTextCommon({ ...defaultTextCommon, ...initialSession.text.common })
        setTextDiffLayout(initialSession.text.diffLayout === 'unified' ? 'unified' : 'split')
        setTextOldSourcePath(initialSession.text.oldSourcePath || '')
        setTextNewSourcePath(initialSession.text.newSourcePath || '')

        setDirectoryLeftRoot(initialSession.directory.leftRoot || '')
        setDirectoryRightRoot(initialSession.directory.rightRoot || '')
        setDirectoryCurrentPath(initialSession.directory.currentPath || '')
        setDirectoryViewMode(initialSession.directory.viewMode === 'tree' ? 'tree' : 'list')

        if (loadTextFile) {
          const safeLoad = async (path: string): Promise<string> => {
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

          const [jsonOld, jsonNew, textOldLoaded, textNewLoaded] = await Promise.all([
            safeLoad(initialSession.json.oldSourcePath || ''),
            safeLoad(initialSession.json.newSourcePath || ''),
            safeLoad(initialSession.text.oldSourcePath || ''),
            safeLoad(initialSession.text.newSourcePath || ''),
          ])

          if (!active) {
            return
          }

          setJSONOldText(jsonOld)
          setJSONNewText(jsonNew)
          setTextOld(textOldLoaded)
          setTextNew(textNewLoaded)
        }
      } catch {
        // keep app usable even when hydration fails
      } finally {
        if (active) {
          hydratedRef.current = true
        }
      }
    }

    void hydrate()
    return () => {
      active = false
    }
  }, [
    enabled,
    initialSession,
    loadTextFile,
    setDirectoryCurrentPath,
    setDirectoryLeftRoot,
    setDirectoryRightRoot,
    setDirectoryViewMode,
    setIgnoreOrder,
    setJSONCommon,
    setJSONIgnorePathsDraft,
    setJSONNewSourcePath,
    setJSONNewText,
    setJSONOldSourcePath,
    setJSONOldText,
    setMode,
    setTextCommon,
    setTextDiffLayout,
    setTextNew,
    setTextNewSourcePath,
    setTextOld,
    setTextOldSourcePath,
  ])

  useEffect(() => {
    if (!enabled || !hydratedRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      commit((prev) => {
        const targetIndex = prev.tabs.findIndex((t) => t.id === initialTabId)
        if (targetIndex < 0) {
          return prev
        }
        const updatedSession: DesktopTabSession = {
          ...prev.tabs[targetIndex],
          lastUsedMode: mode,
          json: {
            oldSourcePath: jsonOldSourcePath,
            newSourcePath: jsonNewSourcePath,
            ignoreOrder,
            common: jsonCommon,
          },
          text: {
            oldSourcePath: textOldSourcePath,
            newSourcePath: textNewSourcePath,
            common: textCommon,
            diffLayout: textDiffLayout,
          },
          directory: {
            leftRoot: directoryLeftRoot,
            rightRoot: directoryRightRoot,
            currentPath: directoryCurrentPath,
            viewMode: directoryViewMode,
          },
        }
        const newTabs = [...prev.tabs]
        newTabs[targetIndex] = updatedSession
        return { ...prev, tabs: newTabs }
      })
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    enabled,
    commit,
    initialTabId,
    mode,
    jsonOldSourcePath,
    jsonNewSourcePath,
    ignoreOrder,
    jsonCommon,
    textOldSourcePath,
    textNewSourcePath,
    textCommon,
    textDiffLayout,
    directoryLeftRoot,
    directoryRightRoot,
    directoryCurrentPath,
    directoryViewMode,
  ])
}
