import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowLeft,
  IconChevronDown,
} from '@tabler/icons-react'
import type {
  CompareCommon,
  CompareFoldersResponse,
  DesktopRecentFolderPair,
  DesktopRecentPair,
  Mode,
} from './types'
import './style.css'
import { useDesktopPersistence } from './useDesktopPersistence'
import { useAppRunOrchestration } from './useAppRunOrchestration'
import { AppChrome } from './ui/AppChrome'
import { CompareWorkspaceShell } from './ui/CompareWorkspaceShell'
import { CompareStatusState } from './ui/CompareStatusState'
import { DesktopModeHeaderActions } from './ui/DesktopModeHeaderActions'
import type { RecentTargetsMenuItem } from './ui/RecentTargetsMenu'
import { upsertRecentPair } from './persistence'
import {
  formatUnknownError,
  parseIgnorePaths,
} from './utils/appHelpers'
import { DirectoryCompareResultPanel } from './features/folder/DirectoryCompareResultPanel'
import { useDirectoryCompareViewState } from './features/folder/useDirectoryCompareViewState'
import { useDirectoryCompareWorkflow } from './features/folder/useDirectoryCompareWorkflow'
import { useDirectoryCompareChildDiffActions } from './features/folder/useDirectoryCompareChildDiffActions'
import { useFolderChildDiffOpeners } from './features/folder/useFolderChildDiffOpeners'
import { useDirectoryCompareInteractions } from './features/folder/useDirectoryCompareInteractions'
import { useTextDiffViewState } from './features/text/useTextDiffViewState'
import { TextCompareResultPanel } from './features/text/TextCompareResultPanel'
import { TextCompareSourceWorkspace } from './features/text/TextCompareSourceWorkspace'
import { TextCompareOptionsPanel } from './features/text/TextCompareOptionsPanel'
import { useTextCompareWorkflow } from './features/text/useTextCompareWorkflow'
import { useJSONCompareViewState } from './features/json/useJSONCompareViewState'
import { JSONCompareResultPanel } from './features/json/JSONCompareResultPanel'
import { JSONCompareSourceWorkspace } from './features/json/JSONCompareSourceWorkspace'
import { JSONCompareOptionsPanel } from './features/json/JSONCompareOptionsPanel'
import { useJSONCompareWorkflow } from './features/json/useJSONCompareWorkflow'
import { useSpecCompareViewState } from './features/spec/useSpecCompareViewState'
import { SpecCompareResultPanel } from './features/spec/SpecCompareResultPanel'
import { SpecCompareSourceWorkspace } from './features/spec/SpecCompareSourceWorkspace'
import { SpecCompareOptionsPanel } from './features/spec/SpecCompareOptionsPanel'
import { useSpecCompareWorkflow } from './features/spec/useSpecCompareWorkflow'
import { ScenarioControlPanel } from './features/scenario/ScenarioControlPanel'
import { ScenarioResultPanel } from './features/scenario/ScenarioResultPanel'
import { useScenarioWorkflow } from './features/scenario/useScenarioWorkflow'

const defaultJSONCommon: CompareCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

const defaultSpecCommon: CompareCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'semantic',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

const defaultTextCommon: CompareCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

const LAST_USED_MODE_STORAGE_KEY = 'xdiff.desktop.lastUsedMode'
const APP_MODES: Mode[] = ['text', 'json', 'spec', 'folder', 'scenario']

function isMode(value: string): value is Mode {
  return APP_MODES.includes(value as Mode)
}

function getInitialMode(): Mode {
  const fallback: Mode = 'json'

  try {
    const raw = window.localStorage.getItem(LAST_USED_MODE_STORAGE_KEY)
    if (!raw) {
      return fallback
    }

    return isMode(raw) ? raw : fallback
  } catch {
    return fallback
  }
}

export function App() {
  const [mode, setMode] = useState<Mode>(() => getInitialMode())

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
  } = useJSONCompareWorkflow({
    initialCommon: defaultJSONCommon,
    getCompareJSONValuesRich: () => api.compareJSONValuesRich,
    getPickJSONFile: () => api.pickJSONFile,
    getLoadTextFile: () => api.loadTextFile,
    onJSONCompareCompleted: (res) => setResult(res),
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
  } = useSpecCompareWorkflow({
    initialCommon: defaultSpecCommon,
    getCompareSpecValuesRich: () => api.compareSpecValuesRich,
    getPickSpecFile: () => api.pickSpecFile,
    getLoadTextFile: () => api.loadTextFile,
    onSpecCompareCompleted: (res) => setResult(res),
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
  } = useTextCompareWorkflow({
    initialCommon: defaultTextCommon,
    getCompareText: () => api.compareText,
    getPickTextFile: () => api.pickTextFile,
    getLoadTextFile: () => api.loadTextFile,
    onTextCompareCompleted: (res) => setResult(res),
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
  } = useTextDiffViewState({
    textResult,
    textLastRunOld,
    textLastRunNew,
    textLastRunOutputFormat,
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
  } = useJSONCompareViewState({
    jsonRichResult,
    jsonOldText,
    jsonNewText,
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
  } = useSpecCompareViewState({
    specRichResult,
    specOldText,
    specNewText,
    textDiffLayout,
  })

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
  const [compareOptionsOpened, setCompareOptionsOpened] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_USED_MODE_STORAGE_KEY, mode)
    } catch {
      // ignore storage errors
    }
  }, [mode])

  const api = useMemo(
    () => ({
      compareJSONValuesRich: (window as any).go?.main?.App?.CompareJSONValuesRich,
      compareSpec: (window as any).go?.main?.App?.CompareSpecFiles,
      compareSpecRich: (window as any).go?.main?.App?.CompareSpecRich,
      compareSpecValuesRich: (window as any).go?.main?.App?.CompareSpecValuesRich,
      compareText: (window as any).go?.main?.App?.CompareText,
      compareFolders: (window as any).go?.main?.App?.CompareFolders,
      runScenario: (window as any).go?.main?.App?.RunScenario,
      listScenarioChecks: (window as any).go?.main?.App?.ListScenarioChecks,
      pickJSONFile: (window as any).go?.main?.App?.PickJSONFile,
      pickSpecFile: (window as any).go?.main?.App?.PickSpecFile,
      pickScenarioFile: (window as any).go?.main?.App?.PickScenarioFile,
      pickTextFile: (window as any).go?.main?.App?.PickTextFile,
      pickFolderRoot: (window as any).go?.main?.App?.PickFolderRoot,
      loadTextFile: (window as any).go?.main?.App?.LoadTextFile,
      loadDesktopState: (window as any).go?.main?.App?.LoadDesktopState,
      saveDesktopState: (window as any).go?.main?.App?.SaveDesktopState,
    }),
    [],
  )

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
  } = useScenarioWorkflow({
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
  } = useDirectoryCompareViewState({
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

  const { browseFolderRoot, runFolderCompare } = useDirectoryCompareWorkflow({
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

  const browseAndSet = async (
    picker: (() => Promise<string>) | undefined,
    setter: (value: string) => void,
  ) => {
    if (!picker) {
      setSummaryLine('error=yes')
      setOutput('Wails bridge not available (file picker)')
      notifications.show({
        title: 'File picker unavailable',
        message: 'Wails bridge not available (file picker)',
        color: 'red',
      })
      return
    }

    try {
      const selected = await picker()
      if (selected) {
        setter(selected)
      }
    } catch (e) {
      setSummaryLine('error=yes')
      setOutput(String(e))
      notifications.show({
        title: 'Failed to pick file',
        message: formatUnknownError(e),
        color: 'red',
      })
    }
  }

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

  const {
    folderOpenBusyPath,
    folderReturnContext,
    openFolderEntryDiff,
    returnToFolderCompare,
  } = useDirectoryCompareChildDiffActions({
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
    navigateFolderPath,
    handleFolderRowDoubleClick,
    handleFolderTreeRowDoubleClick,
    handleFolderTableKeyDown,
    runFolderFromRecent,
  } = useDirectoryCompareInteractions({
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

  const runRecentAction = async (label: string, action: () => Promise<void>) => {
    setLoading(true)
    try {
      await action()
    } catch (error) {
      notifications.show({
        title: `${label} failed`,
        message: formatUnknownError(error),
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }

  const runTextFromRecentWithViewReset = async (pair: DesktopRecentPair) => {
    await runTextFromRecent(pair)
    clearTextExpandedSections()
    resetTextSearch()
  }

  const runJSONFromRecentWithViewReset = async (pair: DesktopRecentPair) => {
    const richResult = await runJSONFromRecent(pair)
    applyJSONResultView(richResult)
    setMode('json')
  }

  const runSpecFromRecentWithViewReset = async (pair: DesktopRecentPair) => {
    const richResult = await runSpecFromRecent(pair)
    applySpecResultView(richResult)
    setMode('spec')
  }

  const renderScenarioResultPanel = () => (
    <ScenarioResultPanel
      scenarioRunResult={scenarioRunResult}
      selectedScenarioResultName={selectedScenarioResultName}
      setSelectedScenarioResultName={setSelectedScenarioResultName}
    />
  )

  const renderTextResultPanel = () => (
    <TextCompareResultPanel
      textResult={textResult}
      textResultView={textResultView}
      setTextResultView={setTextResultView}
      textDiffLayout={textDiffLayout}
      setTextDiffLayout={setTextDiffLayout}
      textSearchQuery={textSearchQuery}
      setTextSearchQuery={setTextSearchQuery}
      textActiveSearchIndex={textActiveSearchIndex}
      normalizedTextSearchQuery={normalizedTextSearchQuery}
      textSearchMatches={textSearchMatches}
      textRichRows={textRichRows}
      textRichItems={textRichItems}
      omittedSectionIds={omittedSectionIds}
      allOmittedSectionsExpanded={allOmittedSectionsExpanded}
      canRenderTextRich={canRenderTextRich}
      textCopyBusy={textCopyBusy}
      copyTextResultRawOutput={copyTextResultRawOutput}
      moveTextSearch={moveTextSearch}
      toggleTextUnchangedSection={toggleTextUnchangedSection}
      toggleAllTextUnchangedSections={toggleAllTextUnchangedSections}
      isTextSectionExpanded={isTextSectionExpanded}
      registerTextSearchRowRef={registerTextSearchRowRef}
    />
  )

  const renderJSONResultPanel = () => (
    <JSONCompareResultPanel
      jsonResult={jsonResult}
      jsonResultView={jsonResultView}
      setJSONResultView={setJSONResultView}
      textDiffLayout={textDiffLayout}
      setTextDiffLayout={setTextDiffLayout}
      jsonSearchQuery={jsonSearchQuery}
      setJSONSearchQuery={setJSONSearchQuery}
      jsonActiveSearchIndex={jsonActiveSearchIndex}
      normalizedJSONSearchQuery={normalizedJSONSearchQuery}
      jsonSearchMatches={jsonSearchMatches}
      jsonDiffSearchMatches={jsonDiffSearchMatches}
      jsonDiffSearchMatchIds={jsonDiffSearchMatchIds}
      activeJSONDiffSearchMatchId={activeJSONDiffSearchMatchId}
      canRenderJSONRich={canRenderJSONRich}
      canRenderJSONDiff={canRenderJSONDiff}
      jsonCopyBusy={jsonCopyBusy}
      copyJSONResultRawOutput={copyJSONResultRawOutput}
      moveJSONSearch={moveJSONSearch}
      jsonDiffTextItems={jsonDiffTextItems}
      jsonDiffRows={jsonDiffRows}
      jsonSummary={jsonRichResult?.summary}
      jsonDiffGroups={jsonDiffGroups}
      effectiveJSONExpandedGroups={effectiveJSONExpandedGroups}
      jsonSearchMatchIndexSet={jsonSearchMatchIndexSet}
      jsonExpandedValueKeys={jsonExpandedValueKeys}
      toggleJSONGroup={toggleJSONGroup}
      toggleJSONExpandedValue={toggleJSONExpandedValue}
      registerJSONDiffSearchRowRef={registerJSONDiffSearchRowRef}
    />
  )

  const renderSpecResultPanel = () => (
    <SpecCompareResultPanel
      specResult={specResult}
      specRichResult={specRichResult}
      specResultView={specResultView}
      setSpecResultView={setSpecResultView}
      textDiffLayout={textDiffLayout}
      setTextDiffLayout={setTextDiffLayout}
      specSearchQuery={specSearchQuery}
      setSpecSearchQuery={setSpecSearchQuery}
      specActiveSearchIndex={specActiveSearchIndex}
      normalizedSpecSearchQuery={normalizedSpecSearchQuery}
      specSearchMatches={specSearchMatches}
      specDiffSearchMatches={specDiffSearchMatches}
      specDiffSearchMatchIds={specDiffSearchMatchIds}
      activeSpecDiffSearchMatchId={activeSpecDiffSearchMatchId}
      canRenderSpecDiff={canRenderSpecDiff}
      specCopyBusy={specCopyBusy}
      copySpecResultRawOutput={copySpecResultRawOutput}
      moveSpecSearch={moveSpecSearch}
      specDiffTextItems={specDiffTextItems}
      specSearchMatchIndexSet={specSearchMatchIndexSet}
      registerSpecDiffSearchRowRef={registerSpecDiffSearchRowRef}
    />
  )

  const renderFolderResultPanel = () => (
    <DirectoryCompareResultPanel
      folderResult={folderResult}
      folderStatus={folderStatus}
      folderLeftRoot={folderLeftRoot}
      folderRightRoot={folderRightRoot}
      folderNameFilter={folderNameFilter}
      folderCurrentPath={folderCurrentPath}
      folderViewMode={folderViewMode}
      folderQuickFilter={folderQuickFilter}
      folderQuickFilterCounts={folderQuickFilterCounts}
      folderSortKey={folderSortKey}
      folderSortDirection={folderSortDirection}
      folderOpenBusyPath={folderOpenBusyPath}
      folderTreeLoadingPath={folderTreeLoadingPath}
      selectedFolderItemPath={selectedFolderItemPath}
      sortedFolderItems={sortedFolderItems}
      flattenedFolderTreeRows={flattenedFolderTreeRows}
      selectedFolderItemForDetail={selectedFolderItemForDetail}
      folderBreadcrumbs={folderBreadcrumbs}
      loading={loading}
      onBrowseFolderRoot={browseFolderRoot}
      onSetFolderNameFilter={setFolderNameFilter}
      onSetFolderViewMode={setFolderViewMode}
      onSetFolderQuickFilter={setFolderQuickFilter}
      onSelectFolderItemPath={setSelectedFolderItemPath}
      onNavigateFolderPath={navigateFolderPath}
      onApplyFolderSort={applyFolderSort}
      onOpenFolderEntryDiff={openFolderEntryDiff}
      onToggleFolderTreeNode={toggleFolderTreeNode}
      onFolderRowDoubleClick={handleFolderRowDoubleClick}
      onFolderTreeRowDoubleClick={handleFolderTreeRowDoubleClick}
      onFolderTableKeyDown={(event) => void handleFolderTableKeyDown(event)}
    />
  )

  const isCompareCentricMode = mode === 'text' || mode === 'json' || mode === 'spec'

  const compareOptionsTitle =
    mode === 'text'
      ? 'Text compare options'
      : mode === 'json'
        ? 'JSON compare options'
        : 'Spec compare options'
  const jsonCompareDisabled = jsonEditorBusy || jsonInputEmpty || jsonInputInvalid
  const specCompareDisabled = specEditorBusy || specInputEmpty || specInputInvalid

  const compareRecentItems: RecentTargetsMenuItem[] =
    mode === 'json'
      ? jsonRecentPairs.map((pair) => ({
          key: `${pair.oldPath}::${pair.newPath}`,
          label: `${pair.oldPath} -> ${pair.newPath}`,
          onClick: () =>
            void runRecentAction('Recent JSON compare', () => runJSONFromRecentWithViewReset(pair)),
        }))
      : mode === 'spec'
        ? specRecentPairs.map((pair) => ({
            key: `${pair.oldPath}::${pair.newPath}`,
            label: `${pair.oldPath} -> ${pair.newPath}`,
            onClick: () =>
              void runRecentAction('Recent Spec compare', () => runSpecFromRecentWithViewReset(pair)),
          }))
        : mode === 'text'
          ? textRecentPairs.map((pair) => ({
              key: `${pair.oldPath}::${pair.newPath}`,
              label: `${pair.oldPath} -> ${pair.newPath}`,
              onClick: () =>
                void runRecentAction('Recent Text compare', () => runTextFromRecentWithViewReset(pair)),
            }))
          : []

  const compareModeHeaderActions = isCompareCentricMode ? (
    <DesktopModeHeaderActions
      kind="compare"
      loading={loading}
      compareDisabled={
        mode === 'json' ? jsonCompareDisabled : mode === 'spec' ? specCompareDisabled : false
      }
      onCompare={() => void onRun()}
      optionsOpen={compareOptionsOpened}
      onToggleOptions={() => setCompareOptionsOpened((prev) => !prev)}
      recentItems={compareRecentItems}
      onClearRecent={
        mode === 'json'
          ? () => setJSONRecentPairs([])
          : mode === 'spec'
            ? () => setSpecRecentPairs([])
            : () => setTextRecentPairs([])
      }
    />
  ) : undefined

  const folderRecentItems: RecentTargetsMenuItem[] = folderRecentPairs.map((entry) => ({
    key: `${entry.leftRoot}::${entry.rightRoot}::${entry.currentPath}::${entry.viewMode}`,
    label: `${entry.leftRoot} <> ${entry.rightRoot}`,
    onClick: () =>
      void runRecentAction('Recent directory compare', () => runFolderFromRecent(entry)),
  }))

  const folderHeaderActions =
    mode === 'folder' ? (
      <DesktopModeHeaderActions
        kind="folder"
        loading={loading}
        compareDisabled={!folderLeftRoot || !folderRightRoot}
        onCompare={() => void onRun()}
        recentItems={folderRecentItems}
        onClearRecent={() => setFolderRecentPairs([])}
      />
    ) : undefined

  const compareOptionsContent =
    mode === 'json' ? (
      <JSONCompareOptionsPanel
        ignoreOrder={ignoreOrder}
        onIgnoreOrderChange={setIgnoreOrder}
        outputFormat={jsonCommon.outputFormat}
        onOutputFormatChange={(value) => updateJSONCommon('outputFormat', value)}
        textStyle={jsonCommon.textStyle}
        onTextStyleChange={(value) => updateJSONCommon('textStyle', value)}
        patchTextStyleDisabled={jsonPatchBlockedByFilters}
        failOn={jsonCommon.failOn}
        onFailOnChange={(value) => updateJSONCommon('failOn', value)}
        ignorePathsDraft={jsonIgnorePathsDraft}
        onIgnorePathsDraftChange={setJSONIgnorePathsDraft}
        onIgnorePathsCommit={(value) =>
          updateJSONCommon('ignorePaths', parseIgnorePaths(value))
        }
        showPaths={jsonCommon.showPaths}
        onShowPathsChange={(checked) => updateJSONCommon('showPaths', checked)}
        onlyBreaking={jsonCommon.onlyBreaking}
        onOnlyBreakingChange={(checked) => updateJSONCommon('onlyBreaking', checked)}
      />
    ) : mode === 'spec' ? (
      <SpecCompareOptionsPanel
        outputFormat={specCommon.outputFormat}
        onOutputFormatChange={(value) => updateSpecCommon('outputFormat', value)}
        textStyle={specCommon.textStyle}
        onTextStyleChange={(value) => updateSpecCommon('textStyle', value)}
        failOn={specCommon.failOn}
        onFailOnChange={(value) => updateSpecCommon('failOn', value)}
        ignorePathsDraft={specIgnorePathsDraft}
        onIgnorePathsDraftChange={setSpecIgnorePathsDraft}
        onIgnorePathsCommit={(value) =>
          updateSpecCommon('ignorePaths', parseIgnorePaths(value))
        }
        showPaths={specCommon.showPaths}
        onShowPathsChange={(checked) => updateSpecCommon('showPaths', checked)}
        onlyBreaking={specCommon.onlyBreaking}
        onOnlyBreakingChange={(checked) => updateSpecCommon('onlyBreaking', checked)}
      />
    ) : (
      <TextCompareOptionsPanel
        outputFormat={textCommon.outputFormat}
        onOutputFormatChange={(value) => updateTextCommon('outputFormat', value)}
        failOn={textCommon.failOn}
        onFailOnChange={(value) => updateTextCommon('failOn', value)}
      />
    )

  const sidebarContent =
    mode === 'scenario' ? (
      <ScenarioControlPanel
        scenarioPath={scenarioPath}
        onScenarioPathChange={setScenarioPath}
        onBrowseScenario={() => void browseAndSet(api.pickScenarioFile, setScenarioPath)}
        scenarioRecentPaths={scenarioRecentPaths}
        onLoadRecentScenario={(entry) =>
          void runRecentAction('Recent scenario load', () => loadScenarioRecent(entry))
        }
        onClearRecentScenarios={() => setScenarioRecentPaths([])}
        reportFormat={reportFormat}
        onReportFormatChange={setReportFormat}
        loading={loading}
        onLoadChecks={handleLoadScenarioChecks}
        onRun={onRun}
        scenarioListStatus={scenarioListStatus}
        scenarioChecks={scenarioChecks}
        selectedChecks={selectedChecks}
        onToggleCheck={toggleScenarioCheck}
        onSelectAllChecks={selectAllScenarioChecks}
        onClearCheckSelection={clearScenarioSelection}
      />
    ) : null

  const folderReturnPathBanner =
    isCompareCentricMode && folderReturnContext ? (
      <div className="folder-return-banner">
        <button
          type="button"
          className="button-secondary button-compact folder-return-button"
          onClick={returnToFolderCompare}
        >
          <IconArrowLeft size={13} />
          Back to directory compare
        </button>
      </div>
    ) : null

  const mainContent =
    mode === 'text' ? (
      <div className="compare-main-shell">
        {folderReturnPathBanner}
        <CompareWorkspaceShell
          source={
            <TextCompareSourceWorkspace
              oldSourcePath={textOldSourcePath}
              newSourcePath={textNewSourcePath}
              oldValue={textOld}
              newValue={textNew}
              busy={textEditorBusy}
              fileBusyTarget={textFileBusyTarget}
              clipboardBusyTarget={textClipboardBusyTarget}
              copyBusyTarget={textPaneCopyBusyTarget}
              onOpenFile={(target) => void loadTextFromFile(target)}
              onPasteClipboard={(target) => void pasteTextFromClipboard(target)}
              onCopyInput={(target) => void copyTextInput(target)}
              onClearInput={clearTextInput}
              onOldChange={setTextOldInput}
              onNewChange={setTextNewInput}
            />
          }
          result={renderTextResultPanel()}
        />
      </div>
    ) : mode === 'json' ? (
      <div className="compare-main-shell">
        {folderReturnPathBanner}
        <CompareWorkspaceShell
          source={
            <JSONCompareSourceWorkspace
              oldSourcePath={jsonOldSourcePath}
              newSourcePath={jsonNewSourcePath}
              oldValue={jsonOldText}
              newValue={jsonNewText}
              oldParseError={jsonOldParseError}
              newParseError={jsonNewParseError}
              busy={jsonEditorBusy}
              fileBusyTarget={jsonFileBusyTarget}
              clipboardBusyTarget={jsonClipboardBusyTarget}
              copyBusyTarget={jsonCopyBusyTarget}
              onOpenFile={(target) => void loadJSONFromFile(target)}
              onPasteClipboard={(target) => void pasteJSONFromClipboard(target)}
              onCopyInput={(target) => void copyJSONInput(target)}
              onClearInput={clearJSONInput}
              onOldChange={setJSONOldInput}
              onNewChange={setJSONNewInput}
            />
          }
          result={renderJSONResultPanel()}
        />
      </div>
    ) : mode === 'spec' ? (
      <div className="compare-main-shell">
        {folderReturnPathBanner}
        <CompareWorkspaceShell
          source={
            <SpecCompareSourceWorkspace
              oldSourcePath={specOldSourcePath}
              newSourcePath={specNewSourcePath}
              oldValue={specOldText}
              newValue={specNewText}
              oldLanguage={specOldLanguage}
              newLanguage={specNewLanguage}
              oldParseError={specOldParseError}
              newParseError={specNewParseError}
              busy={specEditorBusy}
              fileBusyTarget={specFileBusyTarget}
              clipboardBusyTarget={specClipboardBusyTarget}
              copyBusyTarget={specCopyBusyTarget}
              onOpenFile={(target) => void loadSpecFromFile(target)}
              onPasteClipboard={(target) => void pasteSpecFromClipboard(target)}
              onCopyInput={(target) => void copySpecInput(target)}
              onClearInput={clearSpecInput}
              onOldChange={setSpecOldInput}
              onNewChange={setSpecNewInput}
            />
          }
          result={renderSpecResultPanel()}
        />
      </div>
    ) : mode === 'folder' ? (
      <div className="result-panel">{renderFolderResultPanel()}</div>
    ) : (
      <div className="result-panel">
        <h2>Result</h2>
        {renderScenarioResultPanel()}
      </div>
    )

  const compareOptionsInspector = isCompareCentricMode ? (
    <div className="workspace-inspector-panel">
      <div className="workspace-inspector-header">
        <h3>{compareOptionsTitle}</h3>
        <Tooltip label="Close options">
          <ActionIcon
            variant="default"
            size={26}
            aria-label="Close options"
            onClick={() => setCompareOptionsOpened(false)}
          >
            <IconChevronDown size={14} />
          </ActionIcon>
        </Tooltip>
      </div>
      <div className="workspace-inspector-body">{compareOptionsContent}</div>
    </div>
  ) : null
  const isMainFirstMode = isCompareCentricMode || mode === 'folder'

  return (
    <AppChrome
      mode={mode}
      onModeChange={(nextMode) => {
        setMode(nextMode)
        if (nextMode === 'folder' || nextMode === 'scenario') {
          setCompareOptionsOpened(false)
        }
      }}
      layoutMode={isMainFirstMode ? 'workspace' : 'sidebar'}
      sidebar={isMainFirstMode ? undefined : sidebarContent}
      headerActions={
        isCompareCentricMode
          ? compareModeHeaderActions
          : mode === 'folder'
            ? folderHeaderActions
            : undefined
      }
      main={mainContent}
      inspector={isCompareCentricMode ? compareOptionsInspector : undefined}
      inspectorOpen={isCompareCentricMode && compareOptionsOpened}
    />
  )
}
