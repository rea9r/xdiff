import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type {
  DesktopState,
  LoadTextFileRequest,
  LoadTextFileResponse,
  Mode,
} from './types'
import { ignorePathsToText } from './utils/appHelpers'

type StateSetter<T> = Dispatch<SetStateAction<T>>

type LoadDesktopStateFn = () => Promise<DesktopState>
type SaveDesktopStateFn = (state: DesktopState) => Promise<void>
type LoadTextFileFn = (req: LoadTextFileRequest) => Promise<LoadTextFileResponse>

type UseDesktopPersistenceOptions = {
  mode: Mode
  setMode: StateSetter<Mode>
  loadDesktopState?: LoadDesktopStateFn
  saveDesktopState?: SaveDesktopStateFn
  loadTextFile?: LoadTextFileFn
  json: {
    oldSourcePath: string
    newSourcePath: string
    ignoreOrder: boolean
    common: DesktopState['json']['common']
    recentPairs: DesktopState['jsonRecentPairs']
    setIgnoreOrder: StateSetter<boolean>
    setCommon: StateSetter<DesktopState['json']['common']>
    setIgnorePathsDraft: StateSetter<string>
    setOldSourcePath: StateSetter<string>
    setNewSourcePath: StateSetter<string>
    setRecentPairs: StateSetter<DesktopState['jsonRecentPairs']>
    setOldText: StateSetter<string>
    setNewText: StateSetter<string>
  }
  text: {
    oldSourcePath: string
    newSourcePath: string
    common: DesktopState['text']['common']
    diffLayout: DesktopState['text']['diffLayout']
    recentPairs: DesktopState['textRecentPairs']
    setCommon: StateSetter<DesktopState['text']['common']>
    setDiffLayout: StateSetter<DesktopState['text']['diffLayout']>
    setOldSourcePath: StateSetter<string>
    setNewSourcePath: StateSetter<string>
    setRecentPairs: StateSetter<DesktopState['textRecentPairs']>
    setOldText: StateSetter<string>
    setNewText: StateSetter<string>
  }
  folder: {
    leftRoot: string
    rightRoot: string
    currentPath: string
    viewMode: DesktopState['folder']['viewMode']
    recentPairs: DesktopState['folderRecentPairs']
    setLeftRoot: StateSetter<string>
    setRightRoot: StateSetter<string>
    setCurrentPath: StateSetter<string>
    setViewMode: StateSetter<DesktopState['folder']['viewMode']>
    setRecentPairs: StateSetter<DesktopState['folderRecentPairs']>
  }
  scenario: {
    path: string
    reportFormat: DesktopState['scenario']['reportFormat']
    recentPaths: DesktopState['scenarioRecentPaths']
    setPath: StateSetter<string>
    setReportFormat: StateSetter<DesktopState['scenario']['reportFormat']>
    setRecentPaths: StateSetter<DesktopState['scenarioRecentPaths']>
  }
}

const APP_MODES: Mode[] = ['text', 'json', 'folder', 'scenario']

function isMode(value: string): value is Mode {
  return APP_MODES.includes(value as Mode)
}

export function useDesktopPersistence({
  mode,
  setMode,
  loadDesktopState,
  saveDesktopState,
  loadTextFile,
  json,
  text,
  folder,
  scenario,
}: UseDesktopPersistenceOptions) {
  const [desktopStateHydrated, setDesktopStateHydrated] = useState(false)

  const {
    oldSourcePath: jsonOldSourcePath,
    newSourcePath: jsonNewSourcePath,
    ignoreOrder,
    common: jsonCommon,
    recentPairs: jsonRecentPairs,
    setIgnoreOrder,
    setCommon: setJSONCommon,
    setIgnorePathsDraft: setJSONIgnorePathsDraft,
    setOldSourcePath: setJSONOldSourcePath,
    setNewSourcePath: setJSONNewSourcePath,
    setRecentPairs: setJSONRecentPairs,
    setOldText: setJSONOldText,
    setNewText: setJSONNewText,
  } = json

  const {
    oldSourcePath: textOldSourcePath,
    newSourcePath: textNewSourcePath,
    common: textCommon,
    diffLayout: textDiffLayout,
    recentPairs: textRecentPairs,
    setCommon: setTextCommon,
    setDiffLayout: setTextDiffLayout,
    setOldSourcePath: setTextOldSourcePath,
    setNewSourcePath: setTextNewSourcePath,
    setRecentPairs: setTextRecentPairs,
    setOldText: setTextOld,
    setNewText: setTextNew,
  } = text

  const {
    leftRoot: folderLeftRoot,
    rightRoot: folderRightRoot,
    currentPath: folderCurrentPath,
    viewMode: folderViewMode,
    recentPairs: folderRecentPairs,
    setLeftRoot: setFolderLeftRoot,
    setRightRoot: setFolderRightRoot,
    setCurrentPath: setFolderCurrentPath,
    setViewMode: setFolderViewMode,
    setRecentPairs: setFolderRecentPairs,
  } = folder

  const {
    path: scenarioPath,
    reportFormat,
    recentPaths: scenarioRecentPaths,
    setPath: setScenarioPath,
    setReportFormat,
    setRecentPaths: setScenarioRecentPaths,
  } = scenario

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      if (!loadDesktopState) {
        if (active) {
          setDesktopStateHydrated(true)
        }
        return
      }

      try {
        const saved = await loadDesktopState()
        if (!active || !saved) {
          return
        }

        if (isMode(saved.lastUsedMode)) {
          setMode(saved.lastUsedMode)
        }

        setIgnoreOrder(!!saved.json.ignoreOrder)
        setJSONCommon(saved.json.common)
        setJSONIgnorePathsDraft(ignorePathsToText(saved.json.common.ignorePaths))
        setJSONOldSourcePath(saved.json.oldSourcePath || '')
        setJSONNewSourcePath(saved.json.newSourcePath || '')

        setTextCommon(saved.text.common)
        setTextDiffLayout(saved.text.diffLayout === 'unified' ? 'unified' : 'split')
        setTextOldSourcePath(saved.text.oldSourcePath || '')
        setTextNewSourcePath(saved.text.newSourcePath || '')

        setFolderLeftRoot(saved.folder.leftRoot || '')
        setFolderRightRoot(saved.folder.rightRoot || '')
        setFolderCurrentPath(saved.folder.currentPath || '')
        setFolderViewMode(saved.folder.viewMode === 'tree' ? 'tree' : 'list')

        setScenarioPath(saved.scenario.scenarioPath || '')
        setReportFormat(saved.scenario.reportFormat === 'json' ? 'json' : 'text')

        setJSONRecentPairs(saved.jsonRecentPairs ?? [])
        setTextRecentPairs(saved.textRecentPairs ?? [])
        setFolderRecentPairs(saved.folderRecentPairs ?? [])
        setScenarioRecentPaths(saved.scenarioRecentPaths ?? [])

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
            safeLoad(saved.json.oldSourcePath || ''),
            safeLoad(saved.json.newSourcePath || ''),
            safeLoad(saved.text.oldSourcePath || ''),
            safeLoad(saved.text.newSourcePath || ''),
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
        // keep app usable even when persistence load fails
      } finally {
        if (active) {
          setDesktopStateHydrated(true)
        }
      }
    }

    void hydrate()
    return () => {
      active = false
    }
  }, [
    loadDesktopState,
    loadTextFile,
    setFolderCurrentPath,
    setFolderLeftRoot,
    setFolderRecentPairs,
    setFolderRightRoot,
    setFolderViewMode,
    setIgnoreOrder,
    setJSONCommon,
    setJSONIgnorePathsDraft,
    setJSONNewSourcePath,
    setJSONNewText,
    setJSONOldSourcePath,
    setJSONOldText,
    setJSONRecentPairs,
    setMode,
    setReportFormat,
    setScenarioPath,
    setScenarioRecentPaths,
    setTextCommon,
    setTextDiffLayout,
    setTextNew,
    setTextNewSourcePath,
    setTextOld,
    setTextOldSourcePath,
    setTextRecentPairs,
  ])

  useEffect(() => {
    if (!desktopStateHydrated || !saveDesktopState) {
      return
    }

    const timer = window.setTimeout(() => {
      const state: DesktopState = {
        version: 1,
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
        folder: {
          leftRoot: folderLeftRoot,
          rightRoot: folderRightRoot,
          currentPath: folderCurrentPath,
          viewMode: folderViewMode,
        },
        scenario: {
          scenarioPath,
          reportFormat,
        },
        jsonRecentPairs,
        textRecentPairs,
        folderRecentPairs,
        scenarioRecentPaths,
      }

      void saveDesktopState(state).catch(() => {
        // keep save errors non-fatal
      })
    }, 500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    desktopStateHydrated,
    folderCurrentPath,
    folderLeftRoot,
    folderRecentPairs,
    folderRightRoot,
    folderViewMode,
    ignoreOrder,
    jsonCommon,
    jsonNewSourcePath,
    jsonOldSourcePath,
    jsonRecentPairs,
    mode,
    reportFormat,
    saveDesktopState,
    scenarioPath,
    scenarioRecentPaths,
    textCommon,
    textDiffLayout,
    textNewSourcePath,
    textOldSourcePath,
    textRecentPairs,
  ])
}
