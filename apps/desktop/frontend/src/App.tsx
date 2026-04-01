import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconChevronDown } from '@tabler/icons-react'
import type {
  CompareCommon,
  CompareFoldersResponse,
  DesktopRecentFolderPair,
  Mode,
} from './types'
import './style.css'
import { useDesktopPersistence } from './useDesktopPersistence'
import { useAppRunOrchestration } from './useAppRunOrchestration'
import { useRecentActionRunner } from './useRecentActionRunner'
import { useDesktopHeaderActions } from './useDesktopHeaderActions'
import { AppChrome } from './ui/AppChrome'
import { DesktopCompareOptionsContent } from './ui/DesktopCompareOptionsContent'
import { DesktopSidebarContent } from './ui/DesktopSidebarContent'
import { DesktopMainContent } from './ui/DesktopMainContent'
import {
  formatUnknownError,
  parseIgnorePaths,
} from './utils/appHelpers'
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

  const { runRecentAction } = useRecentActionRunner({
    setLoading,
  })

  const isCompareCentricMode = mode === 'text' || mode === 'json' || mode === 'spec'

  const compareOptionsTitle =
    mode === 'text'
      ? 'Text compare options'
      : mode === 'json'
        ? 'JSON compare options'
        : 'Spec compare options'
  const jsonCompareDisabled = jsonEditorBusy || jsonInputEmpty || jsonInputInvalid
  const specCompareDisabled = specEditorBusy || specInputEmpty || specInputInvalid

  const { headerActions } = useDesktopHeaderActions({
    mode,
    loading,
    compareOptionsOpened,
    onToggleCompareOptions: () => setCompareOptionsOpened((prev) => !prev),
    jsonCompareDisabled,
    specCompareDisabled,
    folderCompareDisabled: !folderLeftRoot || !folderRightRoot,
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

  const compareOptionsContent = (
    <DesktopCompareOptionsContent
      mode={mode}
      jsonProps={{
        ignoreOrder,
        onIgnoreOrderChange: setIgnoreOrder,
        outputFormat: jsonCommon.outputFormat,
        onOutputFormatChange: (value) => updateJSONCommon('outputFormat', value),
        textStyle: jsonCommon.textStyle,
        onTextStyleChange: (value) => updateJSONCommon('textStyle', value),
        patchTextStyleDisabled: jsonPatchBlockedByFilters,
        failOn: jsonCommon.failOn,
        onFailOnChange: (value) => updateJSONCommon('failOn', value),
        ignorePathsDraft: jsonIgnorePathsDraft,
        onIgnorePathsDraftChange: setJSONIgnorePathsDraft,
        onIgnorePathsCommit: (value) => updateJSONCommon('ignorePaths', parseIgnorePaths(value)),
        showPaths: jsonCommon.showPaths,
        onShowPathsChange: (checked) => updateJSONCommon('showPaths', checked),
        onlyBreaking: jsonCommon.onlyBreaking,
        onOnlyBreakingChange: (checked) => updateJSONCommon('onlyBreaking', checked),
      }}
      specProps={{
        outputFormat: specCommon.outputFormat,
        onOutputFormatChange: (value) => updateSpecCommon('outputFormat', value),
        textStyle: specCommon.textStyle,
        onTextStyleChange: (value) => updateSpecCommon('textStyle', value),
        failOn: specCommon.failOn,
        onFailOnChange: (value) => updateSpecCommon('failOn', value),
        ignorePathsDraft: specIgnorePathsDraft,
        onIgnorePathsDraftChange: setSpecIgnorePathsDraft,
        onIgnorePathsCommit: (value) => updateSpecCommon('ignorePaths', parseIgnorePaths(value)),
        showPaths: specCommon.showPaths,
        onShowPathsChange: (checked) => updateSpecCommon('showPaths', checked),
        onlyBreaking: specCommon.onlyBreaking,
        onOnlyBreakingChange: (checked) => updateSpecCommon('onlyBreaking', checked),
      }}
      textProps={{
        outputFormat: textCommon.outputFormat,
        onOutputFormatChange: (value) => updateTextCommon('outputFormat', value),
        failOn: textCommon.failOn,
        onFailOnChange: (value) => updateTextCommon('failOn', value),
      }}
    />
  )

  const sidebarContent = (
    <DesktopSidebarContent
      mode={mode}
      scenarioProps={{
        scenarioPath,
        onScenarioPathChange: setScenarioPath,
        onBrowseScenario: () => void browseAndSet(api.pickScenarioFile, setScenarioPath),
        scenarioRecentPaths,
        onLoadRecentScenario: (entry) =>
          void runRecentAction('Recent scenario load', () => loadScenarioRecent(entry)),
        onClearRecentScenarios: () => setScenarioRecentPaths([]),
        reportFormat,
        onReportFormatChange: setReportFormat,
        loading,
        onLoadChecks: handleLoadScenarioChecks,
        onRun,
        scenarioListStatus,
        scenarioChecks,
        selectedChecks,
        onToggleCheck: toggleScenarioCheck,
        onSelectAllChecks: selectAllScenarioChecks,
        onClearCheckSelection: clearScenarioSelection,
      }}
    />
  )

  const mainContent = (
    <DesktopMainContent
      mode={mode}
      showFolderReturnBanner={isCompareCentricMode && !!folderReturnContext}
      onReturnToFolderCompare={returnToFolderCompare}
      textSourceProps={{
        oldSourcePath: textOldSourcePath,
        newSourcePath: textNewSourcePath,
        oldValue: textOld,
        newValue: textNew,
        busy: textEditorBusy,
        fileBusyTarget: textFileBusyTarget,
        clipboardBusyTarget: textClipboardBusyTarget,
        copyBusyTarget: textPaneCopyBusyTarget,
        onOpenFile: (target) => void loadTextFromFile(target),
        onPasteClipboard: (target) => void pasteTextFromClipboard(target),
        onCopyInput: (target) => void copyTextInput(target),
        onClearInput: clearTextInput,
        onOldChange: setTextOldInput,
        onNewChange: setTextNewInput,
      }}
      textResultProps={{
        textResult,
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
        textCopyBusy,
        copyTextResultRawOutput,
        moveTextSearch,
        toggleTextUnchangedSection,
        toggleAllTextUnchangedSections,
        isTextSectionExpanded,
        registerTextSearchRowRef,
      }}
      jsonSourceProps={{
        oldSourcePath: jsonOldSourcePath,
        newSourcePath: jsonNewSourcePath,
        oldValue: jsonOldText,
        newValue: jsonNewText,
        oldParseError: jsonOldParseError,
        newParseError: jsonNewParseError,
        busy: jsonEditorBusy,
        fileBusyTarget: jsonFileBusyTarget,
        clipboardBusyTarget: jsonClipboardBusyTarget,
        copyBusyTarget: jsonCopyBusyTarget,
        onOpenFile: (target) => void loadJSONFromFile(target),
        onPasteClipboard: (target) => void pasteJSONFromClipboard(target),
        onCopyInput: (target) => void copyJSONInput(target),
        onClearInput: clearJSONInput,
        onOldChange: setJSONOldInput,
        onNewChange: setJSONNewInput,
      }}
      jsonResultProps={{
        jsonResult,
        jsonResultView,
        setJSONResultView,
        textDiffLayout,
        setTextDiffLayout,
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
        jsonCopyBusy,
        copyJSONResultRawOutput,
        moveJSONSearch,
        jsonDiffTextItems,
        jsonDiffRows,
        jsonSummary: jsonRichResult?.summary,
        jsonDiffGroups,
        effectiveJSONExpandedGroups,
        jsonSearchMatchIndexSet,
        jsonExpandedValueKeys,
        toggleJSONGroup,
        toggleJSONExpandedValue,
        registerJSONDiffSearchRowRef,
      }}
      specSourceProps={{
        oldSourcePath: specOldSourcePath,
        newSourcePath: specNewSourcePath,
        oldValue: specOldText,
        newValue: specNewText,
        oldLanguage: specOldLanguage,
        newLanguage: specNewLanguage,
        oldParseError: specOldParseError,
        newParseError: specNewParseError,
        busy: specEditorBusy,
        fileBusyTarget: specFileBusyTarget,
        clipboardBusyTarget: specClipboardBusyTarget,
        copyBusyTarget: specCopyBusyTarget,
        onOpenFile: (target) => void loadSpecFromFile(target),
        onPasteClipboard: (target) => void pasteSpecFromClipboard(target),
        onCopyInput: (target) => void copySpecInput(target),
        onClearInput: clearSpecInput,
        onOldChange: setSpecOldInput,
        onNewChange: setSpecNewInput,
      }}
      specResultProps={{
        specResult,
        specRichResult,
        specResultView,
        setSpecResultView,
        textDiffLayout,
        setTextDiffLayout,
        specSearchQuery,
        setSpecSearchQuery,
        specActiveSearchIndex,
        normalizedSpecSearchQuery,
        specSearchMatches,
        specDiffSearchMatches,
        specDiffSearchMatchIds,
        activeSpecDiffSearchMatchId,
        canRenderSpecDiff,
        specCopyBusy,
        copySpecResultRawOutput,
        moveSpecSearch,
        specDiffTextItems,
        specSearchMatchIndexSet,
        registerSpecDiffSearchRowRef,
      }}
      folderResultProps={{
        folderResult,
        folderStatus,
        folderLeftRoot,
        folderRightRoot,
        folderNameFilter,
        folderCurrentPath,
        folderViewMode,
        folderQuickFilter,
        folderQuickFilterCounts,
        folderSortKey,
        folderSortDirection,
        folderOpenBusyPath,
        folderTreeLoadingPath,
        selectedFolderItemPath,
        sortedFolderItems,
        flattenedFolderTreeRows,
        selectedFolderItemForDetail,
        folderBreadcrumbs,
        loading,
        onBrowseFolderRoot: browseFolderRoot,
        onSetFolderNameFilter: setFolderNameFilter,
        onSetFolderViewMode: setFolderViewMode,
        onSetFolderQuickFilter: setFolderQuickFilter,
        onSelectFolderItemPath: setSelectedFolderItemPath,
        onNavigateFolderPath: navigateFolderPath,
        onApplyFolderSort: applyFolderSort,
        onOpenFolderEntryDiff: openFolderEntryDiff,
        onToggleFolderTreeNode: toggleFolderTreeNode,
        onFolderRowDoubleClick: handleFolderRowDoubleClick,
        onFolderTreeRowDoubleClick: handleFolderTreeRowDoubleClick,
        onFolderTableKeyDown: (event) => void handleFolderTableKeyDown(event),
      }}
      scenarioResultProps={{
        scenarioRunResult,
        selectedScenarioResultName,
        setSelectedScenarioResultName,
      }}
    />
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
      headerActions={headerActions}
      main={mainContent}
      inspector={isCompareCentricMode ? compareOptionsInspector : undefined}
      inspectorOpen={isCompareCentricMode && compareOptionsOpened}
    />
  )
}
