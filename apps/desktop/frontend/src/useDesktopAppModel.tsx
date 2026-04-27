import type { useDesktopBridge } from './useDesktopBridge'
import { useBrowseAndSet } from './useBrowseAndSet'
import type { DesktopRecentPairsState } from './useDesktopRecentPairs'
import { useDesktopPersistence } from './useDesktopPersistence'
import { useRecentActionRunner } from './useRecentActionRunner'
import { useDesktopHeaderActions } from './useDesktopHeaderActions'
import { useDesktopShellModel } from './useDesktopShellModel'
import { useDesktopTabModel } from './useDesktopTabModel'
import { deriveTabLabel } from './utils/deriveTabLabel'
import type { DesktopTabSession } from './types'
import type { DesktopStatePersistor } from './useDesktopStatePersistor'

export type UseDesktopAppModelOptions = {
  api: ReturnType<typeof useDesktopBridge>
  recentPairs: DesktopRecentPairsState
  initialSession: DesktopTabSession
  tabId: string
  commit: DesktopStatePersistor['commit']
}

export function useDesktopAppModel({
  api,
  recentPairs,
  initialSession,
  tabId,
  commit,
}: UseDesktopAppModelOptions) {
  const tab = useDesktopTabModel({ api, recentPairs })
  const { mode, setMode, onModeChange, diffOptionsOpened, setDiffOptionsOpened, loading } =
    tab
  const { textModel, jsonModel, directoryModel } = tab

  useDesktopPersistence({
    initialSession,
    tabId,
    commit,
    loadTextFile: api.loadTextFile,
    mode,
    setMode,
    json: {
      oldSourcePath: jsonModel.workflow.jsonOldSourcePath,
      newSourcePath: jsonModel.workflow.jsonNewSourcePath,
      ignoreOrder: jsonModel.workflow.ignoreOrder,
      common: jsonModel.workflow.jsonCommon,
      setIgnoreOrder: jsonModel.workflow.setIgnoreOrder,
      setCommon: jsonModel.workflow.setJSONCommon,
      setIgnorePathsDraft: jsonModel.workflow.setJSONIgnorePathsDraft,
      setOldSourcePath: jsonModel.workflow.setJSONOldSourcePath,
      setNewSourcePath: jsonModel.workflow.setJSONNewSourcePath,
      setOldText: jsonModel.workflow.setJSONOldText,
      setNewText: jsonModel.workflow.setJSONNewText,
    },
    text: {
      oldSourcePath: textModel.workflow.textOldSourcePath,
      newSourcePath: textModel.workflow.textNewSourcePath,
      common: textModel.workflow.textCommon,
      diffLayout: textModel.viewState.textDiffLayout,
      setCommon: textModel.workflow.setTextCommon,
      setDiffLayout: textModel.viewState.setTextDiffLayout,
      setOldSourcePath: textModel.workflow.setTextOldSourcePath,
      setNewSourcePath: textModel.workflow.setTextNewSourcePath,
      setOldText: textModel.workflow.setTextOld,
      setNewText: textModel.workflow.setTextNew,
    },
    directory: {
      leftRoot: directoryModel.state.directoryLeftRoot,
      rightRoot: directoryModel.state.directoryRightRoot,
      currentPath: directoryModel.state.directoryCurrentPath,
      viewMode: directoryModel.viewState.directoryViewMode,
      setLeftRoot: directoryModel.state.setDirectoryLeftRoot,
      setRightRoot: directoryModel.state.setDirectoryRightRoot,
      setCurrentPath: directoryModel.state.setDirectoryCurrentPath,
      setViewMode: directoryModel.viewState.setDirectoryViewMode,
    },
  })

  useBrowseAndSet({ setSummaryLine: tab.setSummaryLine, setOutput: tab.setOutput })
  const { runRecentAction } = useRecentActionRunner({ setLoading: tab.setLoading })

  const { headerActions } = useDesktopHeaderActions({
    mode,
    loading,
    diffOptionsOpened,
    onToggleDiffOptions: () => setDiffOptionsOpened((prev) => !prev),
    jsonDiffDisabled: jsonModel.diffDisabled,
    directoryDiffDisabled: directoryModel.diffDisabled,
    onRun: tab.onRun,
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

  const { layoutMode, sidebar, main, inspector, inspectorOpen, isDirty } = useDesktopShellModel({
    mode,
    setMode,
    loading,
    diffOptionsOpened,
    onCloseDiffOptions: () => setDiffOptionsOpened(false),
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

  const tabLabel = deriveTabLabel({
    mode,
    textOldSourcePath: textModel.workflow.textOldSourcePath,
    textNewSourcePath: textModel.workflow.textNewSourcePath,
    jsonOldSourcePath: jsonModel.workflow.jsonOldSourcePath,
    jsonNewSourcePath: jsonModel.workflow.jsonNewSourcePath,
    directoryLeftRoot: directoryModel.state.directoryLeftRoot,
    directoryRightRoot: directoryModel.state.directoryRightRoot,
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
    tabLabel,
    isDirty,
  }
}
