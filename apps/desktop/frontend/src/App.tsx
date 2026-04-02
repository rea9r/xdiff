import { useState } from 'react'
import { notifications } from '@mantine/notifications'
import type {
  CompareFoldersResponse,
  DesktopRecentFolderPair,
} from './types'
import './style.css'
import { useDesktopBridge } from './useDesktopBridge'
import { useBrowseAndSet } from './useBrowseAndSet'
import {
  defaultJSONCommon,
  defaultSpecCommon,
  defaultTextCommon,
  useDesktopModeState,
} from './useDesktopModeState'
import { useDesktopPersistence } from './useDesktopPersistence'
import { useAppRunOrchestration } from './useAppRunOrchestration'
import { useRecentActionRunner } from './useRecentActionRunner'
import { useDesktopHeaderActions } from './useDesktopHeaderActions'
import { AppChrome } from './ui/AppChrome'
import { useDesktopShellModel } from './useDesktopShellModel'
import { formatUnknownError } from './utils/appHelpers'
import { useDirectoryCompareViewState } from './features/folder/useDirectoryCompareViewState'
import { useDirectoryCompareWorkflow } from './features/folder/useDirectoryCompareWorkflow'
import { useDirectoryCompareChildDiffActions } from './features/folder/useDirectoryCompareChildDiffActions'
import { useFolderChildDiffOpeners } from './features/folder/useFolderChildDiffOpeners'
import { useDirectoryCompareInteractions } from './features/folder/useDirectoryCompareInteractions'
import { useTextDiffViewState } from './features/text/useTextDiffViewState'
import { useTextCompareWorkflow } from './features/text/useTextCompareWorkflow'
import { useJSONCompareViewState } from './features/json/useJSONCompareViewState'
import { useJSONCompareWorkflow } from './features/json/useJSONCompareWorkflow'
import { useSpecCompareViewState } from './features/spec/useSpecCompareViewState'
import { useSpecCompareWorkflow } from './features/spec/useSpecCompareWorkflow'
import { useScenarioWorkflow } from './features/scenario/useScenarioWorkflow'

export function App() {
  const {
    mode,
    setMode,
    compareOptionsOpened,
    setCompareOptionsOpened,
    onModeChange,
  } = useDesktopModeState()

  const jsonWorkflow = useJSONCompareWorkflow({
    initialCommon: defaultJSONCommon,
    getCompareJSONValuesRich: () => api.compareJSONValuesRich,
    getPickJSONFile: () => api.pickJSONFile,
    getLoadTextFile: () => api.loadTextFile,
    onJSONCompareCompleted: (res) => setResult(res),
  })

  const {
    jsonOldText,
    setJSONOldText,
    setJSONOldInput,
    jsonNewText,
    setJSONNewText,
    setJSONNewInput,
    jsonOldSourcePath,
    setJSONOldSourcePath,
    jsonNewSourcePath,
    setJSONNewSourcePath,
    ignoreOrder,
    setIgnoreOrder,
    jsonCommon,
    setJSONCommon,
    updateJSONCommon,
    jsonRichResult,
    setJSONRichResult,
    jsonCopyBusy,
    jsonClipboardBusyTarget,
    jsonFileBusyTarget,
    jsonCopyBusyTarget,
    jsonIgnorePathsDraft,
    setJSONIgnorePathsDraft,
    jsonRecentPairs,
    setJSONRecentPairs,
    jsonPatchBlockedByFilters,
    jsonOldParseError,
    jsonNewParseError,
    jsonInputInvalid,
    jsonInputEmpty,
    jsonEditorBusy,
    runJSON,
    runJSONFromRecent,
    runJSONCompareFromPaths,
    pasteJSONFromClipboard,
    loadJSONFromFile,
    copyJSONInput,
    clearJSONInput,
    copyJSONResultRawOutput,
  } = jsonWorkflow

  const specWorkflow = useSpecCompareWorkflow({
    initialCommon: defaultSpecCommon,
    getCompareSpecValuesRich: () => api.compareSpecValuesRich,
    getPickSpecFile: () => api.pickSpecFile,
    getLoadTextFile: () => api.loadTextFile,
    onSpecCompareCompleted: (res) => setResult(res),
  })

  const {
    specOldText,
    setSpecOldText,
    setSpecOldInput,
    specNewText,
    setSpecNewText,
    setSpecNewInput,
    specOldSourcePath,
    setSpecOldSourcePath,
    specNewSourcePath,
    setSpecNewSourcePath,
    specCommon,
    setSpecCommon,
    updateSpecCommon,
    specRichResult,
    setSpecRichResult,
    specClipboardBusyTarget,
    specFileBusyTarget,
    specCopyBusyTarget,
    specCopyBusy,
    specIgnorePathsDraft,
    setSpecIgnorePathsDraft,
    specRecentPairs,
    setSpecRecentPairs,
    specOldLanguage,
    specNewLanguage,
    specOldParseError,
    specNewParseError,
    specInputInvalid,
    specInputEmpty,
    specEditorBusy,
    runSpec,
    runSpecFromRecent,
    runSpecCompareFromPaths,
    pasteSpecFromClipboard,
    loadSpecFromFile,
    copySpecInput,
    clearSpecInput,
    copySpecResultRawOutput,
  } = specWorkflow

  const textWorkflow = useTextCompareWorkflow({
    initialCommon: defaultTextCommon,
    getCompareText: () => api.compareText,
    getPickTextFile: () => api.pickTextFile,
    getLoadTextFile: () => api.loadTextFile,
    onTextCompareCompleted: (res) => setResult(res),
  })

  const {
    textOld,
    setTextOld,
    setTextOldInput,
    textNew,
    setTextNew,
    setTextNewInput,
    textOldSourcePath,
    setTextOldSourcePath,
    textNewSourcePath,
    setTextNewSourcePath,
    textCommon,
    setTextCommon,
    updateTextCommon,
    textResult,
    setTextResult,
    textLastRunOld,
    setTextLastRunOld,
    textLastRunNew,
    setTextLastRunNew,
    textLastRunOutputFormat,
    setTextLastRunOutputFormat,
    textClipboardBusyTarget,
    textFileBusyTarget,
    textCopyBusy,
    textPaneCopyBusyTarget,
    textEditorBusy,
    textRecentPairs,
    setTextRecentPairs,
    runText,
    runTextFromRecent,
    runTextCompareWithValues,
    pasteTextFromClipboard,
    loadTextFromFile,
    copyTextInput,
    clearTextInput,
    copyTextResultRawOutput,
  } = textWorkflow

  const textDiffViewState = useTextDiffViewState({
    textResult,
    textLastRunOld,
    textLastRunNew,
    textLastRunOutputFormat,
  })

  const {
    textResultView,
    setTextResultView,
    textDiffLayout,
    setTextDiffLayout,
    textSearchQuery,
    setTextSearchQuery,
    textActiveSearchIndex,
    normalizedTextSearchQuery,
    textSearchMatches,
    textRichRows,
    textRichItems,
    omittedSectionIds,
    allOmittedSectionsExpanded,
    canRenderTextRich,
    clearTextExpandedSections,
    resetTextSearch,
    isTextSectionExpanded,
    registerTextSearchRowRef,
    moveTextSearch,
    toggleTextUnchangedSection,
    toggleAllTextUnchangedSections,
  } = textDiffViewState

  const jsonCompareViewState = useJSONCompareViewState({
    jsonRichResult,
    jsonOldText,
    jsonNewText,
    textDiffLayout,
  })

  const {
    jsonResult,
    jsonResultView,
    setJSONResultView,
    jsonSearchQuery,
    setJSONSearchQuery,
    jsonActiveSearchIndex,
    normalizedJSONSearchQuery,
    jsonSearchMatches,
    jsonDiffSearchMatches,
    jsonDiffSearchMatchIds,
    activeJSONDiffSearchMatchId,
    canRenderJSONRich,
    canRenderJSONDiff,
    jsonDiffRows,
    jsonDiffTextItems,
    jsonDiffGroups,
    effectiveJSONExpandedGroups,
    jsonSearchMatchIndexSet,
    jsonExpandedValueKeys,
    moveJSONSearch,
    toggleJSONGroup,
    toggleJSONExpandedValue,
    registerJSONDiffSearchRowRef,
    resetJSONSearch,
  } = jsonCompareViewState

  const specCompareViewState = useSpecCompareViewState({
    specRichResult,
    specOldText,
    specNewText,
    textDiffLayout,
  })

  const {
    specResult,
    specResultView,
    setSpecResultView,
    specSearchQuery,
    setSpecSearchQuery,
    specActiveSearchIndex,
    normalizedSpecSearchQuery,
    specSearchMatches,
    specDiffSearchMatches,
    specDiffSearchMatchIds,
    activeSpecDiffSearchMatchId,
    canRenderSpecDiff,
    specDiffTextItems,
    specSearchMatchIndexSet,
    moveSpecSearch,
    registerSpecDiffSearchRowRef,
    resetSpecSearch,
  } = specCompareViewState

  const [folderLeftRoot, setFolderLeftRoot] = useState('')
  const [folderRightRoot, setFolderRightRoot] = useState('')
  const [folderNameFilter, setFolderNameFilter] = useState('')
  const [folderCurrentPath, setFolderCurrentPath] = useState('')
  const [folderResult, setFolderResult] = useState<CompareFoldersResponse | null>(null)
  const [folderStatus, setFolderStatus] = useState('')
  const [folderRecentPairs, setFolderRecentPairs] = useState<DesktopRecentFolderPair[]>([])


  const [summaryLine, setSummaryLine] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const api = useDesktopBridge()

  const scenarioWorkflow = useScenarioWorkflow({
    listScenarioChecks: api.listScenarioChecks,
    runScenario: api.runScenario,
    onEnterScenarioMode: () => {
      setMode('scenario')
    },
    onScenarioRunCompleted: () => {
      setSummaryLine('')
      setOutput('')
    },
  })

  const {
    scenarioPath,
    setScenarioPath,
    reportFormat,
    setReportFormat,
    scenarioChecks,
    selectedChecks,
    scenarioListStatus,
    scenarioRunResult,
    selectedScenarioResultName,
    setSelectedScenarioResultName,
    scenarioRecentPaths,
    setScenarioRecentPaths,
    loadScenarioRecent,
    runScenario,
    onLoadScenarioChecks,
    toggleScenarioCheck,
    selectAllScenarioChecks,
    clearScenarioSelection,
    setScenarioRunError,
  } = scenarioWorkflow

  const directoryCompareViewState = useDirectoryCompareViewState({
    folderResult,
    folderLeftRoot,
    folderRightRoot,
    folderNameFilter,
    folderCurrentPath,
    compareFolders: api.compareFolders,
    onFolderTreeLoadError: (error) => {
      const message = `Failed to load directory children: ${formatUnknownError(error)}`
      setFolderStatus(message)
      notifications.show({
        title: 'Failed to load directory',
        message,
        color: 'red',
      })
    },
  })

  const {
    folderQuickFilter,
    setFolderQuickFilter,
    folderSortKey,
    folderSortDirection,
    applyFolderSort,
    folderViewMode,
    setFolderViewMode,
    selectedFolderItemPath,
    setSelectedFolderItemPath,
    folderTreeLoadingPath,
    sortedFolderItems,
    flattenedFolderTreeRows,
    selectedFolderItem,
    selectedFolderItemForDetail,
    folderQuickFilterCounts,
    folderBreadcrumbs,
    toggleFolderTreeNode,
    resetFolderNavigationState,
  } = directoryCompareViewState

  const directoryCompareWorkflow = useDirectoryCompareWorkflow({
    isFolderMode: mode === 'folder',
    folderLeftRoot,
    folderRightRoot,
    folderNameFilter,
    folderCurrentPath,
    folderResult,
    folderViewMode,
    pickFolderRoot: api.pickFolderRoot,
    compareFolders: api.compareFolders,
    setFolderLeftRoot,
    setFolderRightRoot,
    setFolderCurrentPath,
    setFolderResult,
    setFolderStatus,
    setFolderRecentPairs,
    setSelectedFolderItemPath,
    onDirectoryPickerUnavailable: () => {
      notifications.show({
        title: 'Directory picker unavailable',
        message: 'Directory picker is not available.',
        color: 'red',
      })
    },
    onDirectoryPickerError: (message) => {
      notifications.show({
        title: 'Failed to pick directory',
        message,
        color: 'red',
      })
    },
  })

  const { browseFolderRoot, runFolderCompare } = directoryCompareWorkflow







  useDesktopPersistence({
    mode,
    setMode,
    loadDesktopState: api.loadDesktopState,
    saveDesktopState: api.saveDesktopState,
    loadTextFile: api.loadTextFile,
    json: {
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
    },
    spec: {
      oldSourcePath: specOldSourcePath,
      newSourcePath: specNewSourcePath,
      common: specCommon,
      recentPairs: specRecentPairs,
      setCommon: setSpecCommon,
      setIgnorePathsDraft: setSpecIgnorePathsDraft,
      setOldSourcePath: setSpecOldSourcePath,
      setNewSourcePath: setSpecNewSourcePath,
      setRecentPairs: setSpecRecentPairs,
      setOldText: setSpecOldText,
      setNewText: setSpecNewText,
    },
    text: {
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
    },
    folder: {
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
    },
    scenario: {
      path: scenarioPath,
      reportFormat,
      recentPaths: scenarioRecentPaths,
      setPath: setScenarioPath,
      setReportFormat,
      setRecentPaths: setScenarioRecentPaths,
    },
  })

  const { browseAndSet } = useBrowseAndSet({
    setSummaryLine,
    setOutput,
  })

  const {
    applyJSONResultView,
    applySpecResultView,
    openFolderJSONDiff,
    openFolderSpecDiff,
    openFolderTextDiff,
  } = useFolderChildDiffOpeners({
    loadTextFile: api.loadTextFile,
    runJSONCompareFromPaths,
    runSpecCompareFromPaths,
    runTextCompareWithValues,
    resetJSONSearch,
    setJSONResultView,
    resetSpecSearch,
    setSpecResultView,
    clearTextExpandedSections,
    resetTextSearch,
    setMode,
  })

  const directoryCompareChildDiffActions = useDirectoryCompareChildDiffActions({
    folderLeftRoot,
    folderRightRoot,
    folderCurrentPath,
    folderViewMode,
    setFolderLeftRoot,
    setFolderRightRoot,
    setFolderCurrentPath,
    setSelectedFolderItemPath,
    setFolderViewMode,
    setFolderStatus,
    setMode,
    onOpenJSONDiff: openFolderJSONDiff,
    onOpenSpecDiff: openFolderSpecDiff,
    onOpenTextDiff: openFolderTextDiff,
    onOpenChildDiffError: (message) => {
      notifications.show({
        title: 'Failed to open child diff',
        message,
        color: 'red',
      })
    },
  })

  const {
    folderOpenBusyPath,
    folderReturnContext,
    openFolderEntryDiff,
    returnToFolderCompare,
  } = directoryCompareChildDiffActions

  const directoryCompareInteractions = useDirectoryCompareInteractions({
    compareFolders: api.compareFolders,
    folderNameFilter,
    folderResult,
    sortedFolderItems,
    selectedFolderItem,
    resetFolderNavigationState,
    openFolderEntryDiff,
    toggleFolderTreeNode,
    setFolderLeftRoot,
    setFolderRightRoot,
    setFolderCurrentPath,
    setFolderViewMode,
    setSelectedFolderItemPath,
    setFolderResult,
    setFolderStatus,
    setFolderRecentPairs,
    setMode,
  })

  const {
    navigateFolderPath,
    handleFolderRowDoubleClick,
    handleFolderTreeRowDoubleClick,
    handleFolderTableKeyDown,
    runFolderFromRecent,
  } = directoryCompareInteractions

  const {
    setResult,
    onRun,
    handleLoadScenarioChecks,
  } = useAppRunOrchestration({
    mode,
    setLoading,
    setSummaryLine,
    setOutput,
    runJSON,
    applyJSONResultView,
    setJSONRichResult,
    runSpec,
    applySpecResultView,
    setSpecRichResult,
    runText,
    setTextResult,
    setTextLastRunOld,
    setTextLastRunNew,
    setTextLastRunOutputFormat,
    clearTextExpandedSections,
    runFolderCompare,
    runScenario,
    onLoadScenarioChecks,
    setScenarioRunError,
  })

  const { runRecentAction } = useRecentActionRunner({
    setLoading,
  })

  const jsonCompareDisabled = jsonEditorBusy || jsonInputEmpty || jsonInputInvalid
  const specCompareDisabled = specEditorBusy || specInputEmpty || specInputInvalid
  const folderCompareDisabled = !folderLeftRoot || !folderRightRoot

  const { headerActions } = useDesktopHeaderActions({
    mode,
    loading,
    compareOptionsOpened,
    onToggleCompareOptions: () => setCompareOptionsOpened((prev) => !prev),
    jsonCompareDisabled,
    specCompareDisabled,
    folderCompareDisabled,
    onRun,
    jsonRecentPairs,
    onClearJSONRecent: () => setJSONRecentPairs([]),
    specRecentPairs,
    onClearSpecRecent: () => setSpecRecentPairs([]),
    textRecentPairs,
    onClearTextRecent: () => setTextRecentPairs([]),
    folderRecentPairs,
    onClearFolderRecent: () => setFolderRecentPairs([]),
    runRecentAction,
    runTextFromRecent,
    clearTextExpandedSections,
    resetTextSearch,
    runJSONFromRecent,
    applyJSONResultView,
    runSpecFromRecent,
    applySpecResultView,
    runFolderFromRecent,
    setMode,
  })

  const {
    layoutMode,
    sidebar,
    main,
    inspector,
    inspectorOpen,
  } = useDesktopShellModel({
    mode,
    loading,
    compareOptionsOpened,
    onCloseCompareOptions: () => setCompareOptionsOpened(false),
    browseAndSet,
    pickScenarioFile: api.pickScenarioFile,
    runRecentAction,
    handleLoadScenarioChecks,
    onRun,
    jsonWorkflow,
    jsonViewState: jsonCompareViewState,
    specWorkflow,
    specViewState: specCompareViewState,
    textWorkflow,
    textViewState: textDiffViewState,
    scenarioWorkflow,
    folderLeftRoot,
    folderRightRoot,
    folderNameFilter,
    setFolderNameFilter,
    folderCurrentPath,
    folderResult,
    folderStatus,
    folderViewState: directoryCompareViewState,
    folderWorkflow: directoryCompareWorkflow,
    folderChildDiffActions: directoryCompareChildDiffActions,
    folderInteractions: directoryCompareInteractions,
  })


  return (
    <AppChrome
      mode={mode}
      onModeChange={onModeChange}
      layoutMode={layoutMode}
      sidebar={sidebar}
      headerActions={headerActions}
      main={main}
      inspector={inspector}
      inspectorOpen={inspectorOpen}
    />
  )
}
