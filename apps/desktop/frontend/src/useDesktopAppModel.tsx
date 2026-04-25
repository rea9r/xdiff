import { useDesktopBridge } from './useDesktopBridge'
import { useBrowseAndSet } from './useBrowseAndSet'
import { useDesktopModeState } from './useDesktopModeState'
import { useDesktopRunUiState } from './useDesktopRunUiState'
import { useDesktopPersistence } from './useDesktopPersistence'
import { useAppRunOrchestration } from './useAppRunOrchestration'
import { useRecentActionRunner } from './useRecentActionRunner'
import { useDesktopHeaderActions } from './useDesktopHeaderActions'
import { useDesktopShellModel } from './useDesktopShellModel'
import { useJSONCompareModel } from './features/json/useJSONCompareModel'
import { useTextCompareModel } from './features/text/useTextCompareModel'
import { useFolderCompareModel } from './features/folder/useFolderCompareModel'

export function useDesktopAppModel() {
  const { mode, setMode, compareOptionsOpened, setCompareOptionsOpened, onModeChange } =
    useDesktopModeState()
  const api = useDesktopBridge()
  const { setSummaryLine, setOutput, loading, setLoading } = useDesktopRunUiState()

  // --- Domain models ---
  // NOTE: onXxxCompleted callbacks are closures that capture `setResult`.
  // They fire asynchronously (never during render), so the forward reference is safe.

  const textModel = useTextCompareModel({
    getCompareText: () => api.compareText,
    getPickTextFile: () => api.pickTextFile,
    getLoadTextFile: () => api.loadTextFile,
    onTextCompareCompleted: (res) => setResult(res),
  })

  const jsonModel = useJSONCompareModel({
    getCompareJSONValuesRich: () => api.compareJSONValuesRich,
    getPickJSONFile: () => api.pickJSONFile,
    getLoadTextFile: () => api.loadTextFile,
    onJSONCompareCompleted: (res) => setResult(res),
    textDiffLayout: textModel.viewState.textDiffLayout,
  })

  const folderModel = useFolderCompareModel({
    mode,
    setMode,
    loadTextFile: api.loadTextFile,
    compareFolders: api.compareFolders,
    pickFolderRoot: api.pickFolderRoot,
    runJSONCompareFromPaths: jsonModel.workflow.runJSONCompareFromPaths,
    runTextCompareWithValues: textModel.workflow.runTextCompareWithValues,
    resetJSONSearch: jsonModel.viewState.resetJSONSearch,
    setJSONResultView: jsonModel.viewState.setJSONResultView,
    clearTextExpandedSections: textModel.viewState.clearTextExpandedSections,
    resetTextSearch: textModel.viewState.resetTextSearch,
  })

  // --- Orchestration ---

  const { setResult, onRun } = useAppRunOrchestration({
    mode,
    setLoading,
    setSummaryLine,
    setOutput,
    runJSON: jsonModel.workflow.runJSON,
    applyJSONResultView: folderModel.childDiffOpeners.applyJSONResultView,
    setJSONRichResult: jsonModel.workflow.setJSONRichResult,
    runText: textModel.workflow.runText,
    setTextResult: textModel.workflow.setTextResult,
    setTextLastRunOld: textModel.workflow.setTextLastRunOld,
    setTextLastRunNew: textModel.workflow.setTextLastRunNew,
    setTextLastRunOutputFormat: textModel.workflow.setTextLastRunOutputFormat,
    clearTextExpandedSections: textModel.viewState.clearTextExpandedSections,
    runFolderCompare: folderModel.workflow.runFolderCompare,
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
      recentPairs: jsonModel.workflow.jsonRecentPairs,
      setIgnoreOrder: jsonModel.workflow.setIgnoreOrder,
      setCommon: jsonModel.workflow.setJSONCommon,
      setIgnorePathsDraft: jsonModel.workflow.setJSONIgnorePathsDraft,
      setOldSourcePath: jsonModel.workflow.setJSONOldSourcePath,
      setNewSourcePath: jsonModel.workflow.setJSONNewSourcePath,
      setRecentPairs: jsonModel.workflow.setJSONRecentPairs,
      setOldText: jsonModel.workflow.setJSONOldText,
      setNewText: jsonModel.workflow.setJSONNewText,
    },
    text: {
      oldSourcePath: textModel.workflow.textOldSourcePath,
      newSourcePath: textModel.workflow.textNewSourcePath,
      common: textModel.workflow.textCommon,
      diffLayout: textModel.viewState.textDiffLayout,
      recentPairs: textModel.workflow.textRecentPairs,
      setCommon: textModel.workflow.setTextCommon,
      setDiffLayout: textModel.viewState.setTextDiffLayout,
      setOldSourcePath: textModel.workflow.setTextOldSourcePath,
      setNewSourcePath: textModel.workflow.setTextNewSourcePath,
      setRecentPairs: textModel.workflow.setTextRecentPairs,
      setOldText: textModel.workflow.setTextOld,
      setNewText: textModel.workflow.setTextNew,
    },
    folder: {
      leftRoot: folderModel.state.folderLeftRoot,
      rightRoot: folderModel.state.folderRightRoot,
      currentPath: folderModel.state.folderCurrentPath,
      viewMode: folderModel.viewState.folderViewMode,
      recentPairs: folderModel.state.folderRecentPairs,
      setLeftRoot: folderModel.state.setFolderLeftRoot,
      setRightRoot: folderModel.state.setFolderRightRoot,
      setCurrentPath: folderModel.state.setFolderCurrentPath,
      setViewMode: folderModel.viewState.setFolderViewMode,
      setRecentPairs: folderModel.state.setFolderRecentPairs,
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
    folderCompareDisabled: folderModel.compareDisabled,
    onRun,
    jsonRecentPairs: jsonModel.workflow.jsonRecentPairs,
    onClearJSONRecent: () => jsonModel.workflow.setJSONRecentPairs([]),
    textRecentPairs: textModel.workflow.textRecentPairs,
    onClearTextRecent: () => textModel.workflow.setTextRecentPairs([]),
    folderRecentPairs: folderModel.state.folderRecentPairs,
    onClearFolderRecent: () => folderModel.state.setFolderRecentPairs([]),
    runRecentAction,
    runTextFromRecent: textModel.workflow.runTextFromRecent,
    clearTextExpandedSections: textModel.viewState.clearTextExpandedSections,
    resetTextSearch: textModel.viewState.resetTextSearch,
    runJSONFromRecent: jsonModel.workflow.runJSONFromRecent,
    applyJSONResultView: folderModel.childDiffOpeners.applyJSONResultView,
    runFolderFromRecent: folderModel.interactions.runFolderFromRecent,
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
    folderLeftRoot: folderModel.state.folderLeftRoot,
    folderRightRoot: folderModel.state.folderRightRoot,
    folderNameFilter: folderModel.state.folderNameFilter,
    setFolderNameFilter: folderModel.state.setFolderNameFilter,
    folderCurrentPath: folderModel.state.folderCurrentPath,
    folderResult: folderModel.state.folderResult,
    folderStatus: folderModel.state.folderStatus,
    folderViewState: folderModel.viewState,
    folderWorkflow: folderModel.workflow,
    folderChildDiffActions: folderModel.childDiffActions,
    folderInteractions: folderModel.interactions,
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
