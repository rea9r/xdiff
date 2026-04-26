import { useDesktopBridge } from './useDesktopBridge'
import { useBrowseAndSet } from './useBrowseAndSet'
import { useDesktopModeState } from './useDesktopModeState'
import { useDesktopRunUiState } from './useDesktopRunUiState'
import { useDesktopRecentPairs } from './useDesktopRecentPairs'
import { useDesktopPersistence } from './useDesktopPersistence'
import { useAppRunOrchestration } from './useAppRunOrchestration'
import { useRecentActionRunner } from './useRecentActionRunner'
import { useDesktopHeaderActions } from './useDesktopHeaderActions'
import { useDesktopShellModel } from './useDesktopShellModel'
import { useJSONCompareModel } from './features/json/useJSONCompareModel'
import { useTextCompareModel } from './features/text/useTextCompareModel'
import { useDirectoryCompareModel } from './features/directory/useDirectoryCompareModel'
import { useFileDrop } from './features/dragdrop/useFileDrop'

export function useDesktopAppModel() {
  const { mode, setMode, compareOptionsOpened, setCompareOptionsOpened, onModeChange } =
    useDesktopModeState()
  const api = useDesktopBridge()
  const { setSummaryLine, setOutput, loading, setLoading } = useDesktopRunUiState()
  const recentPairs = useDesktopRecentPairs()

  // --- Domain models ---
  // NOTE: onXxxCompleted callbacks are closures that capture `setResult`.
  // They fire asynchronously (never during render), so the forward reference is safe.

  const textModel = useTextCompareModel({
    getCompareText: () => api.compareText,
    getPickTextFile: () => api.pickTextFile,
    getLoadTextFile: () => api.loadTextFile,
    onTextCompareCompleted: (res) => setResult(res),
    setTextRecentPairs: recentPairs.setTextRecentPairs,
  })

  const jsonModel = useJSONCompareModel({
    getCompareJSONValuesRich: () => api.compareJSONValuesRich,
    getPickJSONFile: () => api.pickJSONFile,
    getLoadTextFile: () => api.loadTextFile,
    onJSONCompareCompleted: (res) => setResult(res),
    textDiffLayout: textModel.viewState.textDiffLayout,
    setJSONRecentPairs: recentPairs.setJSONRecentPairs,
  })

  const directoryModel = useDirectoryCompareModel({
    mode,
    setMode,
    loadTextFile: api.loadTextFile,
    compareDirectories: api.compareDirectories,
    pickDirectoryRoot: api.pickDirectoryRoot,
    runJSONCompareFromPaths: jsonModel.workflow.runJSONCompareFromPaths,
    runTextCompareWithValues: textModel.workflow.runTextCompareWithValues,
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
    runDirectoryCompare: directoryModel.workflow.runDirectoryCompare,
  })

  // --- Persistence ---

  useDesktopPersistence({
    mode,
    setMode,
    loadDesktopState: api.loadDesktopState,
    saveDesktopState: api.saveDesktopState,
    loadTextFile: api.loadTextFile,
    json: {
      oldSourcePath: jsonModel.workflow.jsonOldSourcePath,
      newSourcePath: jsonModel.workflow.jsonNewSourcePath,
      ignoreOrder: jsonModel.workflow.ignoreOrder,
      common: jsonModel.workflow.jsonCommon,
      recentPairs: recentPairs.jsonRecentPairs,
      setIgnoreOrder: jsonModel.workflow.setIgnoreOrder,
      setCommon: jsonModel.workflow.setJSONCommon,
      setIgnorePathsDraft: jsonModel.workflow.setJSONIgnorePathsDraft,
      setOldSourcePath: jsonModel.workflow.setJSONOldSourcePath,
      setNewSourcePath: jsonModel.workflow.setJSONNewSourcePath,
      setRecentPairs: recentPairs.setJSONRecentPairs,
      setOldText: jsonModel.workflow.setJSONOldText,
      setNewText: jsonModel.workflow.setJSONNewText,
    },
    text: {
      oldSourcePath: textModel.workflow.textOldSourcePath,
      newSourcePath: textModel.workflow.textNewSourcePath,
      common: textModel.workflow.textCommon,
      diffLayout: textModel.viewState.textDiffLayout,
      recentPairs: recentPairs.textRecentPairs,
      setCommon: textModel.workflow.setTextCommon,
      setDiffLayout: textModel.viewState.setTextDiffLayout,
      setOldSourcePath: textModel.workflow.setTextOldSourcePath,
      setNewSourcePath: textModel.workflow.setTextNewSourcePath,
      setRecentPairs: recentPairs.setTextRecentPairs,
      setOldText: textModel.workflow.setTextOld,
      setNewText: textModel.workflow.setTextNew,
    },
    directory: {
      leftRoot: directoryModel.state.directoryLeftRoot,
      rightRoot: directoryModel.state.directoryRightRoot,
      currentPath: directoryModel.state.directoryCurrentPath,
      viewMode: directoryModel.viewState.directoryViewMode,
      recentPairs: recentPairs.directoryRecentPairs,
      setLeftRoot: directoryModel.state.setDirectoryLeftRoot,
      setRightRoot: directoryModel.state.setDirectoryRightRoot,
      setCurrentPath: directoryModel.state.setDirectoryCurrentPath,
      setViewMode: directoryModel.viewState.setDirectoryViewMode,
      setRecentPairs: recentPairs.setDirectoryRecentPairs,
    },
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

  // --- UI chrome ---

  const { browseAndSet } = useBrowseAndSet({ setSummaryLine, setOutput })
  const { runRecentAction } = useRecentActionRunner({ setLoading })

  const { headerActions } = useDesktopHeaderActions({
    mode,
    loading,
    compareOptionsOpened,
    onToggleCompareOptions: () => setCompareOptionsOpened((prev) => !prev),
    jsonCompareDisabled: jsonModel.compareDisabled,
    directoryCompareDisabled: directoryModel.compareDisabled,
    onRun,
    jsonRecentPairs: recentPairs.jsonRecentPairs,
    onClearJSONRecent: () => recentPairs.setJSONRecentPairs([]),
    textRecentPairs: recentPairs.textRecentPairs,
    onClearTextRecent: () => recentPairs.setTextRecentPairs([]),
    directoryRecentPairs: recentPairs.directoryRecentPairs,
    onClearDirectoryRecent: () => recentPairs.setDirectoryRecentPairs([]),
    runRecentAction,
    runTextFromRecent: textModel.workflow.runTextFromRecent,
    clearTextExpandedSections: textModel.viewState.clearTextExpandedSections,
    resetTextSearch: textModel.viewState.resetTextSearch,
    runJSONFromRecent: jsonModel.workflow.runJSONFromRecent,
    applyJSONResultView: directoryModel.childDiffOpeners.applyJSONResultView,
    runDirectoryFromRecent: directoryModel.interactions.runDirectoryFromRecent,
    setMode,
  })

  const { layoutMode, sidebar, main, inspector, inspectorOpen } = useDesktopShellModel({
    mode,
    setMode,
    loading,
    compareOptionsOpened,
    onCloseCompareOptions: () => setCompareOptionsOpened(false),
    jsonWorkflow: jsonModel.workflow,
    jsonViewState: jsonModel.viewState,
    textWorkflow: textModel.workflow,
    textViewState: textModel.viewState,
    directoryLeftRoot: directoryModel.state.directoryLeftRoot,
    directoryRightRoot: directoryModel.state.directoryRightRoot,
    directoryNameFilter: directoryModel.state.directoryNameFilter,
    setDirectoryNameFilter: directoryModel.state.setDirectoryNameFilter,
    directoryCurrentPath: directoryModel.state.directoryCurrentPath,
    directoryResult: directoryModel.state.directoryResult,
    directoryStatus: directoryModel.state.directoryStatus,
    directoryViewState: directoryModel.viewState,
    directoryWorkflow: directoryModel.workflow,
    directoryChildDiffActions: directoryModel.childDiffActions,
    directoryInteractions: directoryModel.interactions,
  })

  return {
    mode,
    onModeChange,
    layoutMode,
    sidebar,
    headerActions,
    main,
    inspector,
    inspectorOpen,
  }
}
