import { useDesktopBridge } from './useDesktopBridge'
import { useDesktopModeState } from './useDesktopModeState'
import { useDesktopRunUiState } from './useDesktopRunUiState'
import { useAppRunOrchestration } from './useAppRunOrchestration'
import { useJSONDiffModel } from './features/json/useJSONDiffModel'
import { useTextDiffModel } from './features/text/useTextDiffModel'
import { useDirectoryDiffModel } from './features/directory/useDirectoryDiffModel'
import { useFileDrop } from './features/dragdrop/useFileDrop'
import type { DesktopRecentPairsState } from './useDesktopRecentPairs'

export type UseDesktopTabModelOptions = {
  api: ReturnType<typeof useDesktopBridge>
  recentPairs: DesktopRecentPairsState
}

export function useDesktopTabModel({ api, recentPairs }: UseDesktopTabModelOptions) {
  const { mode, setMode, diffOptionsOpened, setDiffOptionsOpened, onModeChange } =
    useDesktopModeState()
  const { setSummaryLine, setOutput, loading, setLoading } = useDesktopRunUiState()

  // --- Domain models ---
  // NOTE: onXxxCompleted callbacks are closures that capture `setResult`.
  // They fire asynchronously (never during render), so the forward reference is safe.

  const textModel = useTextDiffModel({
    getDiffText: () => api.diffText,
    getPickTextFile: () => api.pickTextFile,
    getPickSaveTextFile: () => api.pickSaveTextFile,
    getLoadTextFile: () => api.loadTextFile,
    getSaveTextFile: () => api.saveTextFile,
    onTextDiffCompleted: (res) => setResult(res),
    setTextRecentPairs: recentPairs.setTextRecentPairs,
  })

  const jsonModel = useJSONDiffModel({
    getDiffJSONValuesRich: () => api.diffJSONValuesRich,
    getPickJSONFile: () => api.pickJSONFile,
    getLoadTextFile: () => api.loadTextFile,
    onJSONDiffCompleted: (res) => setResult(res),
    textDiffLayout: textModel.viewState.textDiffLayout,
    setJSONRecentPairs: recentPairs.setJSONRecentPairs,
  })

  const directoryModel = useDirectoryDiffModel({
    mode,
    setMode,
    loadTextFile: api.loadTextFile,
    diffDirectories: api.diffDirectories,
    pickDirectoryRoot: api.pickDirectoryRoot,
    runJSONDiffFromPaths: jsonModel.workflow.runJSONDiffFromPaths,
    runTextDiffWithValues: textModel.workflow.runTextDiffWithValues,
    resetJSONSearch: jsonModel.viewState.resetJSONSearch,
    setJSONResultView: jsonModel.viewState.setJSONResultView,
    clearTextExpandedSections: textModel.viewState.clearTextExpandedSections,
    resetTextSearch: textModel.viewState.resetTextSearch,
    setDirectoryRecentPairs: recentPairs.setDirectoryRecentPairs,
  })

  // --- Orchestration ---

  const { setResult, onRun } = useAppRunOrchestration({
    mode,
    setLoading,
    setSummaryLine,
    setOutput,
    runJSON: jsonModel.workflow.runJSON,
    applyJSONResultView: directoryModel.childDiffOpeners.applyJSONResultView,
    setJSONRichResult: jsonModel.workflow.setJSONRichResult,
    runText: textModel.workflow.runText,
    setTextResult: textModel.workflow.setTextResult,
    setTextLastRunOld: textModel.workflow.setTextLastRunOld,
    setTextLastRunNew: textModel.workflow.setTextLastRunNew,
    setTextLastRunOutputFormat: textModel.workflow.setTextLastRunOutputFormat,
    clearTextExpandedSections: textModel.viewState.clearTextExpandedSections,
    runDirectoryDiff: directoryModel.workflow.runDirectoryDiff,
  })

  // --- Drag & drop ---

  useFileDrop({
    'text-old': (paths) => {
      void textModel.workflow.loadTextFromPath('old', paths[0])
      if (paths[1]) {
        void textModel.workflow.loadTextFromPath('new', paths[1])
      }
    },
    'text-new': (paths) => {
      void textModel.workflow.loadTextFromPath('new', paths[0])
    },
    'json-old': (paths) => {
      void jsonModel.workflow.loadJSONFromPath('old', paths[0])
      if (paths[1]) {
        void jsonModel.workflow.loadJSONFromPath('new', paths[1])
      }
    },
    'json-new': (paths) => {
      void jsonModel.workflow.loadJSONFromPath('new', paths[0])
    },
    'directory-left': (paths) => {
      directoryModel.workflow.setDirectoryRootPath('left', paths[0])
      if (paths[1]) {
        directoryModel.workflow.setDirectoryRootPath('right', paths[1])
      }
    },
    'directory-right': (paths) => {
      directoryModel.workflow.setDirectoryRootPath('right', paths[0])
    },
  })

  return {
    mode,
    setMode,
    onModeChange,
    diffOptionsOpened,
    setDiffOptionsOpened,
    loading,
    setLoading,
    setSummaryLine,
    setOutput,
    textModel,
    jsonModel,
    directoryModel,
    onRun,
  }
}

export type DesktopTabModel = ReturnType<typeof useDesktopTabModel>
