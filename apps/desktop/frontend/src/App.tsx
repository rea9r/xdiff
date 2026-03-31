import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react'
import { ActionIcon, Menu, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import YAML from 'yaml'
import {
  IconArrowLeft,
  IconArrowsDiff,
  IconChevronDown,
  IconHistory,
} from '@tabler/icons-react'
import type {
  CompareCommon,
  CompareFoldersRequest,
  CompareFoldersResponse,
  CompareJSONRichResponse,
  CompareJSONValuesRequest,
  CompareSpecRichResponse,
  CompareSpecValuesRequest,
  CompareResponse,
  DesktopRecentFolderPair,
  DesktopRecentPair,
  DesktopState,
  FolderCompareItem,
  LoadTextFileRequest,
  LoadTextFileResponse,
  Mode,
} from './types'
import './style.css'
import { AppChrome } from './ui/AppChrome'
import { CompareWorkspaceShell } from './ui/CompareWorkspaceShell'
import { CompareStatusState } from './ui/CompareStatusState'
import { CompareModeHeaderActions } from './ui/CompareModeHeaderActions'
import { HeaderRailGroup, HeaderRailPrimaryButton } from './ui/HeaderRail'
import {
  upsertRecentFolderPair,
  upsertRecentPair,
} from './persistence'
import {
  getRuntimeClipboardRead,
  getRuntimeClipboardWrite,
  formatUnknownError,
  ignorePathsToText,
  parseIgnorePaths,
  renderResult,
  summarizeResponse,
} from './utils/appHelpers'
import {
  canOpenFolderItem,
  type FolderTreeNode,
} from './features/folder/folderTree'
import { DirectoryCompareResultPanel } from './features/folder/DirectoryCompareResultPanel'
import { useDirectoryCompareViewState } from './features/folder/useDirectoryCompareViewState'
import { useDirectoryCompareWorkflow } from './features/folder/useDirectoryCompareWorkflow'
import { useDirectoryCompareChildDiffActions } from './features/folder/useDirectoryCompareChildDiffActions'
import { useTextDiffViewState } from './features/text/useTextDiffViewState'
import { TextCompareResultPanel } from './features/text/TextCompareResultPanel'
import { TextCompareSourceWorkspace } from './features/text/TextCompareSourceWorkspace'
import { TextCompareOptionsPanel } from './features/text/TextCompareOptionsPanel'
import { useTextCompareWorkflow } from './features/text/useTextCompareWorkflow'
import { useJSONCompareViewState } from './features/json/useJSONCompareViewState'
import { JSONCompareResultPanel } from './features/json/JSONCompareResultPanel'
import { JSONCompareSourceWorkspace } from './features/json/JSONCompareSourceWorkspace'
import { JSONCompareOptionsPanel } from './features/json/JSONCompareOptionsPanel'
import { useSpecCompareViewState } from './features/spec/useSpecCompareViewState'
import { SpecCompareResultPanel } from './features/spec/SpecCompareResultPanel'
import { SpecCompareSourceWorkspace } from './features/spec/SpecCompareSourceWorkspace'
import { SpecCompareOptionsPanel } from './features/spec/SpecCompareOptionsPanel'
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

type StructuredResultView = 'diff' | 'semantic' | 'raw'
type TextInputTarget = 'old' | 'new'

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

function getJSONParseError(input: string): string | null {
  if (!input.trim()) {
    return null
  }

  try {
    JSON.parse(input)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function detectSpecInputLanguage(sourcePath: string, value: string): 'json' | 'yaml' {
  const lowerPath = sourcePath.toLowerCase()
  if (lowerPath.endsWith('.json')) {
    return 'json'
  }
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) {
    return 'yaml'
  }

  const trimmed = value.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json'
  }
  return 'yaml'
}

function getSpecParseError(input: string, language: 'json' | 'yaml'): string | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  try {
    if (language === 'json') {
      JSON.parse(trimmed)
    } else {
      YAML.parse(trimmed)
    }
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function chooseDefaultDisplayModeForMode(options: {
  mode: 'json' | 'spec'
  hasDiffText: boolean
  canRenderSemantic: boolean
}): StructuredResultView {
  if (options.mode === 'json') {
    if (options.hasDiffText) {
      return 'diff'
    }
    if (options.canRenderSemantic) {
      return 'semantic'
    }
    return 'raw'
  }

  if (options.canRenderSemantic) {
    return 'semantic'
  }
  if (options.hasDiffText) {
    return 'diff'
  }
  return 'raw'
}

export function App() {
  const [mode, setMode] = useState<Mode>(() => getInitialMode())

  const [jsonOldText, setJSONOldText] = useState('')
  const [jsonNewText, setJSONNewText] = useState('')
  const [jsonOldSourcePath, setJSONOldSourcePath] = useState('')
  const [jsonNewSourcePath, setJSONNewSourcePath] = useState('')
  const [ignoreOrder, setIgnoreOrder] = useState(false)
  const [jsonCommon, setJSONCommon] = useState<CompareCommon>(defaultJSONCommon)
  const [jsonRichResult, setJSONRichResult] = useState<CompareJSONRichResponse | null>(null)
  const [jsonCopyBusy, setJSONCopyBusy] = useState(false)
  const [jsonClipboardBusyTarget, setJSONClipboardBusyTarget] =
    useState<TextInputTarget | null>(null)
  const [jsonFileBusyTarget, setJSONFileBusyTarget] = useState<TextInputTarget | null>(null)
  const [jsonCopyBusyTarget, setJSONCopyBusyTarget] = useState<TextInputTarget | null>(null)
  const [jsonIgnorePathsDraft, setJSONIgnorePathsDraft] = useState(() =>
    ignorePathsToText(defaultJSONCommon.ignorePaths),
  )

  const [specOldText, setSpecOldText] = useState('')
  const [specNewText, setSpecNewText] = useState('')
  const [specOldSourcePath, setSpecOldSourcePath] = useState('')
  const [specNewSourcePath, setSpecNewSourcePath] = useState('')
  const [specCommon, setSpecCommon] = useState<CompareCommon>(defaultSpecCommon)
  const [specRichResult, setSpecRichResult] = useState<CompareSpecRichResponse | null>(null)
  const [specClipboardBusyTarget, setSpecClipboardBusyTarget] =
    useState<TextInputTarget | null>(null)
  const [specFileBusyTarget, setSpecFileBusyTarget] = useState<TextInputTarget | null>(null)
  const [specCopyBusyTarget, setSpecCopyBusyTarget] = useState<TextInputTarget | null>(null)
  const [specCopyBusy, setSpecCopyBusy] = useState(false)
  const [specIgnorePathsDraft, setSpecIgnorePathsDraft] = useState(() =>
    ignorePathsToText(defaultSpecCommon.ignorePaths),
  )

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

  const [jsonRecentPairs, setJSONRecentPairs] = useState<DesktopRecentPair[]>([])
  const [specRecentPairs, setSpecRecentPairs] = useState<DesktopRecentPair[]>([])
  const [desktopStateHydrated, setDesktopStateHydrated] = useState(false)

  const [summaryLine, setSummaryLine] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [compareOptionsOpened, setCompareOptionsOpened] = useState(false)

  const effectiveJSONIgnorePaths = parseIgnorePaths(jsonIgnorePathsDraft)
  const effectiveSpecIgnorePaths = parseIgnorePaths(specIgnorePathsDraft)

  const jsonPatchBlockedByFilters =
    ignoreOrder || jsonCommon.onlyBreaking || effectiveJSONIgnorePaths.length > 0
  const jsonOldParseError = useMemo(() => getJSONParseError(jsonOldText), [jsonOldText])
  const jsonNewParseError = useMemo(() => getJSONParseError(jsonNewText), [jsonNewText])
  const jsonInputInvalid = !!jsonOldParseError || !!jsonNewParseError
  const jsonInputEmpty = !jsonOldText.trim() || !jsonNewText.trim()
  const jsonEditorBusy = jsonClipboardBusyTarget !== null || jsonFileBusyTarget !== null
  const specOldLanguage = useMemo(
    () => detectSpecInputLanguage(specOldSourcePath, specOldText),
    [specOldSourcePath, specOldText],
  )
  const specNewLanguage = useMemo(
    () => detectSpecInputLanguage(specNewSourcePath, specNewText),
    [specNewSourcePath, specNewText],
  )
  const specOldParseError = useMemo(
    () => getSpecParseError(specOldText, specOldLanguage),
    [specOldText, specOldLanguage],
  )
  const specNewParseError = useMemo(
    () => getSpecParseError(specNewText, specNewLanguage),
    [specNewText, specNewLanguage],
  )
  const specInputInvalid = !!specOldParseError || !!specNewParseError
  const specInputEmpty = !specOldText.trim() || !specNewText.trim()
  const specEditorBusy = specClipboardBusyTarget !== null || specFileBusyTarget !== null
  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_USED_MODE_STORAGE_KEY, mode)
    } catch {
      // ignore storage errors
    }
  }, [mode])

  useEffect(() => {
    if (jsonCommon.textStyle !== 'patch') {
      return
    }
    if (!jsonPatchBlockedByFilters) {
      return
    }
    setJSONCommon((prev) => ({ ...prev, textStyle: 'semantic' }))
  }, [jsonCommon.textStyle, jsonPatchBlockedByFilters])

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

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      const loadDesktopState = api.loadDesktopState as (() => Promise<DesktopState>) | undefined
      const loadTextFile = api.loadTextFile

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

        setSpecCommon(saved.spec.common)
        setSpecIgnorePathsDraft(ignorePathsToText(saved.spec.common.ignorePaths))
        setSpecOldSourcePath(saved.spec.oldSourcePath || '')
        setSpecNewSourcePath(saved.spec.newSourcePath || '')

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
        setSpecRecentPairs(saved.specRecentPairs ?? [])
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

          const [jsonOld, jsonNew, specOld, specNew, textOldLoaded, textNewLoaded] =
            await Promise.all([
              safeLoad(saved.json.oldSourcePath || ''),
              safeLoad(saved.json.newSourcePath || ''),
              safeLoad(saved.spec.oldSourcePath || ''),
              safeLoad(saved.spec.newSourcePath || ''),
              safeLoad(saved.text.oldSourcePath || ''),
              safeLoad(saved.text.newSourcePath || ''),
            ])

          if (!active) {
            return
          }

          setJSONOldText(jsonOld)
          setJSONNewText(jsonNew)
          setSpecOldText(specOld)
          setSpecNewText(specNew)
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
  }, [api.loadDesktopState, api.loadTextFile])

  useEffect(() => {
    if (!desktopStateHydrated) {
      return
    }
    const saveDesktopState = api.saveDesktopState as
      | ((state: DesktopState) => Promise<void>)
      | undefined
    if (!saveDesktopState) {
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
        spec: {
          oldSourcePath: specOldSourcePath,
          newSourcePath: specNewSourcePath,
          common: specCommon,
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
        specRecentPairs,
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
    api.saveDesktopState,
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
    scenarioPath,
    scenarioRecentPaths,
    specCommon,
    specNewSourcePath,
    specOldSourcePath,
    specRecentPairs,
    textCommon,
    textDiffLayout,
    textNewSourcePath,
    textOldSourcePath,
    textRecentPairs,
  ])

  const setResult = (res: unknown) => {
    setSummaryLine(summarizeResponse(res))
    setOutput(renderResult(res))
  }

  const nowISO = () => new Date().toISOString()

  const updateJSONCommon = <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
    setJSONCommon((prev) => ({ ...prev, [key]: value }))
  }

  const updateSpecCommon = <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
    setSpecCommon((prev) => ({ ...prev, [key]: value }))
  }

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

  const openFolderJSONDiff = async (entry: FolderCompareItem) => {
    const richFn = api.compareJSONValuesRich
    const loader = api.loadTextFile
    if (!richFn || !loader) {
      throw new Error('Wails bridge not available (CompareJSONValuesRich/LoadTextFile)')
    }

    const safeJSONCommon = {
      ...jsonCommon,
      ignorePaths: effectiveJSONIgnorePaths,
      textStyle:
        jsonCommon.textStyle === 'patch' && jsonPatchBlockedByFilters
          ? 'semantic'
          : jsonCommon.textStyle,
    }

    const oldLoaded: LoadTextFileResponse = await loader({
      path: entry.leftPath,
    } satisfies LoadTextFileRequest)
    const newLoaded: LoadTextFileResponse = await loader({
      path: entry.rightPath,
    } satisfies LoadTextFileRequest)

    const richRes: CompareJSONRichResponse = await richFn({
      oldValue: oldLoaded.content,
      newValue: newLoaded.content,
      common: safeJSONCommon,
      ignoreOrder,
    } satisfies CompareJSONValuesRequest)

    setJSONOldText(oldLoaded.content)
    setJSONNewText(newLoaded.content)
    setJSONOldSourcePath(oldLoaded.path)
    setJSONNewSourcePath(newLoaded.path)
    setJSONRichResult(richRes)
    resetJSONSearch()
    setJSONResultView(
      chooseDefaultDisplayModeForMode({
        mode: 'json',
        hasDiffText: richRes.diffText.trim().length > 0,
        canRenderSemantic: !richRes.result.error,
      }),
    )
    setJSONRecentPairs((prev) =>
      upsertRecentPair(prev, {
        oldPath: oldLoaded.path,
        newPath: newLoaded.path,
        usedAt: nowISO(),
      }),
    )
    setMode('json')
    setResult(richRes.result)
  }

  const openFolderSpecDiff = async (entry: FolderCompareItem) => {
    const richFn = api.compareSpecValuesRich
    const loader = api.loadTextFile
    if (!richFn || !loader) {
      throw new Error('Wails bridge not available (CompareSpecValuesRich/LoadTextFile)')
    }

    const safeSpecCommon = {
      ...specCommon,
      ignorePaths: effectiveSpecIgnorePaths,
      textStyle: specCommon.textStyle === 'patch' ? 'semantic' : specCommon.textStyle,
    }

    const oldLoaded: LoadTextFileResponse = await loader({
      path: entry.leftPath,
    } satisfies LoadTextFileRequest)
    const newLoaded: LoadTextFileResponse = await loader({
      path: entry.rightPath,
    } satisfies LoadTextFileRequest)

    const richRes: CompareSpecRichResponse = await richFn({
      oldValue: oldLoaded.content,
      newValue: newLoaded.content,
      common: safeSpecCommon,
    } satisfies CompareSpecValuesRequest)

    setSpecOldText(oldLoaded.content)
    setSpecNewText(newLoaded.content)
    setSpecOldSourcePath(oldLoaded.path)
    setSpecNewSourcePath(newLoaded.path)
    setSpecRichResult(richRes)
    resetSpecSearch()
    setSpecResultView(
      chooseDefaultDisplayModeForMode({
        mode: 'spec',
        hasDiffText: richRes.diffText.trim().length > 0,
        canRenderSemantic: !richRes.result.error,
      }),
    )
    setSpecRecentPairs((prev) =>
      upsertRecentPair(prev, {
        oldPath: oldLoaded.path,
        newPath: newLoaded.path,
        usedAt: nowISO(),
      }),
    )
    setMode('spec')
    setResult(richRes.result)
  }

  const openFolderTextDiff = async (entry: FolderCompareItem) => {
    const loadText = api.loadTextFile
    if (!loadText) {
      throw new Error('Wails bridge not available (LoadTextFile)')
    }

    const [leftLoaded, rightLoaded] = await Promise.all([
      loadText({ path: entry.leftPath } satisfies LoadTextFileRequest),
      loadText({ path: entry.rightPath } satisfies LoadTextFileRequest),
    ])

    await runTextCompareWithValues({
      oldText: leftLoaded.content,
      newText: rightLoaded.content,
      oldSourcePath: leftLoaded.path,
      newSourcePath: rightLoaded.path,
    })
    clearTextExpandedSections()
    resetTextSearch()
    setMode('text')
  }

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

  const navigateFolderPath = (nextPath: string) => {
    resetFolderNavigationState()
    setFolderCurrentPath(nextPath)
  }

  const handleFolderRowDoubleClick = async (item: FolderCompareItem) => {
    const enterable = item.isDir && item.status !== 'type-mismatch'
    if (enterable) {
      navigateFolderPath(item.relativePath)
      return
    }

    if (canOpenFolderItem(item)) {
      await openFolderEntryDiff(item)
    }
  }

  const handleFolderTreeRowDoubleClick = async (node: FolderTreeNode) => {
    if (node.isDir && node.item.status !== 'type-mismatch') {
      await toggleFolderTreeNode(node)
      return
    }
    if (canOpenFolderItem(node.item)) {
      await openFolderEntryDiff(node.item)
    }
  }

  const handleFolderTableKeyDown = async (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (!target) {
      return
    }
    const tagName = target.tagName.toLowerCase()
    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable
    ) {
      return
    }

    if (sortedFolderItems.length === 0) {
      return
    }

    const currentIndex = selectedFolderItem
      ? sortedFolderItems.findIndex((item) => item.relativePath === selectedFolderItem.relativePath)
      : -1

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, sortedFolderItems.length - 1)
      setSelectedFolderItemPath(sortedFolderItems[nextIndex].relativePath)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1
      setSelectedFolderItemPath(sortedFolderItems[nextIndex].relativePath)
      return
    }

    if (event.key === 'Enter' && selectedFolderItem) {
      event.preventDefault()
      await handleFolderRowDoubleClick(selectedFolderItem)
      return
    }

    if (event.key === 'Backspace' && folderResult?.currentPath) {
      event.preventDefault()
      navigateFolderPath(folderResult.parentPath || '')
    }
  }

  const runJSON = async () => {
    const richFn = api.compareJSONValuesRich
    if (!richFn) throw new Error('Wails bridge not available (CompareJSONValuesRich)')

    const safeJSONCommon = {
      ...jsonCommon,
      ignorePaths: effectiveJSONIgnorePaths,
      textStyle:
        jsonCommon.textStyle === 'patch' && jsonPatchBlockedByFilters
          ? 'semantic'
          : jsonCommon.textStyle,
    }

    const richRes: CompareJSONRichResponse = await richFn({
      oldValue: jsonOldText,
      newValue: jsonNewText,
      common: safeJSONCommon,
      ignoreOrder,
    } satisfies CompareJSONValuesRequest)
    setJSONRichResult(richRes)
    setJSONResultView(
      chooseDefaultDisplayModeForMode({
        mode: 'json',
        hasDiffText: richRes.diffText.trim().length > 0,
        canRenderSemantic: !richRes.result.error,
      }),
    )
    resetJSONSearch()
    setResult(richRes.result)
    if (jsonOldSourcePath.trim() && jsonNewSourcePath.trim()) {
      setJSONRecentPairs((prev) =>
        upsertRecentPair(prev, {
          oldPath: jsonOldSourcePath,
          newPath: jsonNewSourcePath,
          usedAt: nowISO(),
        }),
      )
    }
  }

  const runSpec = async () => {
    const richFn = api.compareSpecValuesRich
    if (!richFn) throw new Error('Wails bridge not available (CompareSpecValuesRich)')

    const safeSpecCommon = {
      ...specCommon,
      ignorePaths: effectiveSpecIgnorePaths,
      textStyle: specCommon.textStyle === 'patch' ? 'semantic' : specCommon.textStyle,
    }

    const richRes: CompareSpecRichResponse = await richFn({
      oldValue: specOldText,
      newValue: specNewText,
      common: safeSpecCommon,
    } satisfies CompareSpecValuesRequest)
    setSpecRichResult(richRes)
    resetSpecSearch()
    setSpecResultView(
      chooseDefaultDisplayModeForMode({
        mode: 'spec',
        hasDiffText: richRes.diffText.trim().length > 0,
        canRenderSemantic: !richRes.result.error,
      }),
    )
    setResult(richRes.result)
    if (specOldSourcePath.trim() && specNewSourcePath.trim()) {
      setSpecRecentPairs((prev) =>
        upsertRecentPair(prev, {
          oldPath: specOldSourcePath,
          newPath: specNewSourcePath,
          usedAt: nowISO(),
        }),
      )
    }
  }

  const runJSONFromRecent = async (pair: DesktopRecentPair) => {
    const loader = api.loadTextFile
    const richFn = api.compareJSONValuesRich
    if (!loader || !richFn) {
      throw new Error('Wails bridge not available (LoadTextFile/CompareJSONValuesRich)')
    }

    const [oldLoaded, newLoaded] = await Promise.all([
      loader({ path: pair.oldPath } satisfies LoadTextFileRequest),
      loader({ path: pair.newPath } satisfies LoadTextFileRequest),
    ])

    const safeJSONCommon = {
      ...jsonCommon,
      ignorePaths: effectiveJSONIgnorePaths,
      textStyle:
        jsonCommon.textStyle === 'patch' && jsonPatchBlockedByFilters
          ? 'semantic'
          : jsonCommon.textStyle,
    }

    const richRes: CompareJSONRichResponse = await richFn({
      oldValue: oldLoaded.content,
      newValue: newLoaded.content,
      common: safeJSONCommon,
      ignoreOrder,
    } satisfies CompareJSONValuesRequest)

    setMode('json')
    setJSONOldSourcePath(oldLoaded.path)
    setJSONNewSourcePath(newLoaded.path)
    setJSONOldText(oldLoaded.content)
    setJSONNewText(newLoaded.content)
    setJSONRichResult(richRes)
    setJSONResultView(
      chooseDefaultDisplayModeForMode({
        mode: 'json',
        hasDiffText: richRes.diffText.trim().length > 0,
        canRenderSemantic: !richRes.result.error,
      }),
    )
    resetJSONSearch()
    setResult(richRes.result)
    setJSONRecentPairs((prev) =>
      upsertRecentPair(prev, {
        oldPath: oldLoaded.path,
        newPath: newLoaded.path,
        usedAt: nowISO(),
      }),
    )
  }

  const runSpecFromRecent = async (pair: DesktopRecentPair) => {
    const loader = api.loadTextFile
    const richFn = api.compareSpecValuesRich
    if (!loader || !richFn) {
      throw new Error('Wails bridge not available (LoadTextFile/CompareSpecValuesRich)')
    }

    const [oldLoaded, newLoaded] = await Promise.all([
      loader({ path: pair.oldPath } satisfies LoadTextFileRequest),
      loader({ path: pair.newPath } satisfies LoadTextFileRequest),
    ])

    const safeSpecCommon = {
      ...specCommon,
      ignorePaths: effectiveSpecIgnorePaths,
      textStyle: specCommon.textStyle === 'patch' ? 'semantic' : specCommon.textStyle,
    }

    const richRes: CompareSpecRichResponse = await richFn({
      oldValue: oldLoaded.content,
      newValue: newLoaded.content,
      common: safeSpecCommon,
    } satisfies CompareSpecValuesRequest)

    setMode('spec')
    setSpecOldSourcePath(oldLoaded.path)
    setSpecNewSourcePath(newLoaded.path)
    setSpecOldText(oldLoaded.content)
    setSpecNewText(newLoaded.content)
    setSpecRichResult(richRes)
    setSpecResultView(
      chooseDefaultDisplayModeForMode({
        mode: 'spec',
        hasDiffText: richRes.diffText.trim().length > 0,
        canRenderSemantic: !richRes.result.error,
      }),
    )
    resetSpecSearch()
    setResult(richRes.result)
    setSpecRecentPairs((prev) =>
      upsertRecentPair(prev, {
        oldPath: oldLoaded.path,
        newPath: newLoaded.path,
        usedAt: nowISO(),
      }),
    )
  }

  const runFolderFromRecent = async (entry: DesktopRecentFolderPair) => {
    const fn = api.compareFolders
    if (!fn) {
      throw new Error('Wails bridge not available (CompareFolders)')
    }

    const leftRoot = entry.leftRoot
    const rightRoot = entry.rightRoot
    const currentPath = entry.currentPath
    const viewMode = entry.viewMode

    const res: CompareFoldersResponse = await fn({
      leftRoot,
      rightRoot,
      currentPath,
      recursive: true,
      showSame: true,
      nameFilter: folderNameFilter,
    } satisfies CompareFoldersRequest)

    setMode('folder')
    setFolderLeftRoot(leftRoot)
    setFolderRightRoot(rightRoot)
    setFolderCurrentPath(res.currentPath ?? currentPath)
    setFolderViewMode(viewMode === 'tree' ? 'tree' : 'list')
    setFolderResult(res)
    setFolderStatus(res.error ?? '')

    if (!res.error) {
      setFolderRecentPairs((prev) =>
        upsertRecentFolderPair(prev, {
          leftRoot,
          rightRoot,
          currentPath: res.currentPath ?? currentPath,
          viewMode: viewMode === 'tree' ? 'tree' : 'list',
          usedAt: nowISO(),
        }),
      )
    }
  }

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

  const pasteJSONFromClipboard = async (target: TextInputTarget) => {
    const readClipboard = getRuntimeClipboardRead()
    if (!readClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    setJSONClipboardBusyTarget(target)

    try {
      const pasted = await readClipboard()
      if (!pasted) {
        notifications.show({
          title: 'Clipboard is empty',
          message: 'Nothing to paste.',
          color: 'yellow',
        })
        return
      }

      if (target === 'old') {
        setJSONOldText(pasted)
        setJSONOldSourcePath('')
      } else {
        setJSONNewText(pasted)
        setJSONNewSourcePath('')
      }
    } catch (error) {
      notifications.show({
        title: 'Failed to paste from clipboard',
        message: `Failed to read clipboard: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setJSONClipboardBusyTarget(null)
    }
  }

  const loadJSONFromFile = async (target: TextInputTarget) => {
    const picker = api.pickJSONFile
    const loader = api.loadTextFile
    if (!picker || !loader) {
      notifications.show({
        title: 'JSON loader unavailable',
        message: 'JSON file loader is not available.',
        color: 'red',
      })
      return
    }

    setJSONFileBusyTarget(target)

    try {
      const selected = await picker()
      if (!selected) {
        return
      }

      const loaded: LoadTextFileResponse = await loader({
        path: selected,
      } satisfies LoadTextFileRequest)

      if (target === 'old') {
        setJSONOldText(loaded.content)
        setJSONOldSourcePath(loaded.path)
      } else {
        setJSONNewText(loaded.content)
        setJSONNewSourcePath(loaded.path)
      }
    } catch (error) {
      notifications.show({
        title: 'Failed to load JSON file',
        message: `Failed to load JSON file: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setJSONFileBusyTarget(null)
    }
  }

  const copyJSONInput = async (target: TextInputTarget) => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    const value = target === 'old' ? jsonOldText : jsonNewText
    if (!value) {
      return
    }

    setJSONCopyBusyTarget(target)
    try {
      const ok = await writeClipboard(value)
      if (!ok) {
        notifications.show({
          title: 'Copy failed',
          message: `Failed to copy ${target === 'old' ? 'Old' : 'New'} JSON.`,
          color: 'red',
        })
        return
      }

      notifications.show({
        title: 'Copied',
        message: `${target === 'old' ? 'Old' : 'New'} JSON copied to clipboard.`,
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Copy failed',
        message: `Failed to copy JSON: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setJSONCopyBusyTarget(null)
    }
  }

  const clearJSONInput = (target: TextInputTarget) => {
    if (target === 'old') {
      setJSONOldText('')
      setJSONOldSourcePath('')
      return
    }

    setJSONNewText('')
    setJSONNewSourcePath('')
  }

  const pasteSpecFromClipboard = async (target: TextInputTarget) => {
    const readClipboard = getRuntimeClipboardRead()
    if (!readClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    setSpecClipboardBusyTarget(target)
    try {
      const pasted = await readClipboard()
      if (!pasted) {
        notifications.show({
          title: 'Clipboard is empty',
          message: 'Nothing to paste.',
          color: 'yellow',
        })
        return
      }

      if (target === 'old') {
        setSpecOldText(pasted)
        setSpecOldSourcePath('')
      } else {
        setSpecNewText(pasted)
        setSpecNewSourcePath('')
      }
    } catch (error) {
      notifications.show({
        title: 'Failed to paste from clipboard',
        message: `Failed to read clipboard: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setSpecClipboardBusyTarget(null)
    }
  }

  const loadSpecFromFile = async (target: TextInputTarget) => {
    const picker = api.pickSpecFile
    const loader = api.loadTextFile
    if (!picker || !loader) {
      notifications.show({
        title: 'Spec loader unavailable',
        message: 'Spec file loader is not available.',
        color: 'red',
      })
      return
    }

    setSpecFileBusyTarget(target)
    try {
      const selected = await picker()
      if (!selected) {
        return
      }

      const loaded: LoadTextFileResponse = await loader({
        path: selected,
      } satisfies LoadTextFileRequest)

      if (target === 'old') {
        setSpecOldText(loaded.content)
        setSpecOldSourcePath(loaded.path)
      } else {
        setSpecNewText(loaded.content)
        setSpecNewSourcePath(loaded.path)
      }
    } catch (error) {
      notifications.show({
        title: 'Failed to load spec file',
        message: `Failed to load spec file: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setSpecFileBusyTarget(null)
    }
  }

  const copySpecInput = async (target: TextInputTarget) => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    const value = target === 'old' ? specOldText : specNewText
    if (!value) {
      return
    }

    setSpecCopyBusyTarget(target)
    try {
      const ok = await writeClipboard(value)
      if (!ok) {
        notifications.show({
          title: 'Copy failed',
          message: `Failed to copy ${target === 'old' ? 'Old' : 'New'} spec.`,
          color: 'red',
        })
        return
      }

      notifications.show({
        title: 'Copied',
        message: `${target === 'old' ? 'Old' : 'New'} spec copied to clipboard.`,
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Copy failed',
        message: `Failed to copy spec: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setSpecCopyBusyTarget(null)
    }
  }

  const clearSpecInput = (target: TextInputTarget) => {
    if (target === 'old') {
      setSpecOldText('')
      setSpecOldSourcePath('')
      return
    }

    setSpecNewText('')
    setSpecNewSourcePath('')
  }

  const copyJSONResultRawOutput = async () => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    const raw = jsonResult ? renderResult(jsonResult) : ''
    if (!raw) {
      return
    }

    setJSONCopyBusy(true)

    try {
      const ok = await writeClipboard(raw)
      if (!ok) {
        notifications.show({
          title: 'Copy failed',
          message: 'Failed to copy raw output.',
          color: 'red',
        })
        return
      }

      notifications.show({
        title: 'Copied',
        message: 'Raw output copied to clipboard.',
        color: 'green',
      })
    } catch (error) {
      const message = `Failed to copy raw output: ${formatUnknownError(error)}`
      notifications.show({
        title: 'Copy failed',
        message,
        color: 'red',
      })
    } finally {
      setJSONCopyBusy(false)
    }
  }

  const copySpecResultRawOutput = async () => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    const raw = specResult ? renderResult(specResult) : ''
    if (!raw) {
      return
    }

    setSpecCopyBusy(true)
    try {
      const ok = await writeClipboard(raw)
      if (!ok) {
        notifications.show({
          title: 'Copy failed',
          message: 'Failed to copy raw output.',
          color: 'red',
        })
        return
      }

      notifications.show({
        title: 'Copied',
        message: 'Raw output copied to clipboard.',
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Copy failed',
        message: `Failed to copy raw output: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setSpecCopyBusy(false)
    }
  }

  const runByMode = async () => {
    if (mode === 'json') {
      await runJSON()
      return
    }
    if (mode === 'spec') {
      await runSpec()
      return
    }
    if (mode === 'text') {
      await runText()
      return
    }
    if (mode === 'folder') {
      await runFolderCompare()
      return
    }
    await runScenario()
  }

  const onRun = async () => {
    setLoading(true)

    if (mode !== 'scenario') {
      setSummaryLine('')
      setOutput('')
    }
    if (mode === 'text') {
      setTextResult(null)
      setTextLastRunOld('')
      setTextLastRunNew('')
      setTextLastRunOutputFormat(null)
      clearTextExpandedSections()
    }
    if (mode === 'spec') {
      setSpecRichResult(null)
    }

    try {
      await runByMode()
    } catch (e) {
      if (mode === 'scenario') {
        setScenarioRunError(String(e))
      } else {
        if (mode === 'text') {
          setTextResult({
            exitCode: 2,
            diffFound: false,
            output: '',
            error: String(e),
          })
        } else if (mode === 'json') {
          setJSONRichResult({
            result: {
              exitCode: 2,
              diffFound: false,
              output: '',
              error: String(e),
            },
            diffText: '',
            summary: {
              added: 0,
              removed: 0,
              changed: 0,
              typeChanged: 0,
              breaking: 0,
            },
            diffs: [],
          })
        } else if (mode === 'spec') {
          setSpecRichResult({
            result: {
              exitCode: 2,
              diffFound: false,
              output: '',
              error: String(e),
            },
            diffText: '',
            summary: {
              added: 0,
              removed: 0,
              changed: 0,
              typeChanged: 0,
              breaking: 0,
            },
            diffs: [],
          })
        }
        setSummaryLine('error=yes')
        setOutput(String(e))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLoadScenarioChecks = async () => {
    setLoading(true)

    try {
      await onLoadScenarioChecks()
    } finally {
      setLoading(false)
    }
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

  const compareRecentMenu =
    isCompareCentricMode && mode === 'json' ? (
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <HeaderRailPrimaryButton
            variant="default"
            leftSection={<IconHistory size={14} />}
            disabled={jsonRecentPairs.length === 0}
          >
            Recent
          </HeaderRailPrimaryButton>
        </Menu.Target>
        <Menu.Dropdown>
          {jsonRecentPairs.map((pair) => (
            <Menu.Item
              key={`${pair.oldPath}::${pair.newPath}`}
              onClick={() =>
                void runRecentAction('Recent JSON compare', () => runJSONFromRecent(pair))
              }
            >
              {`${pair.oldPath} -> ${pair.newPath}`}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item color="red" onClick={() => setJSONRecentPairs([])}>
            Clear recent
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    ) : isCompareCentricMode && mode === 'spec' ? (
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <HeaderRailPrimaryButton
            variant="default"
            leftSection={<IconHistory size={14} />}
            disabled={specRecentPairs.length === 0}
          >
            Recent
          </HeaderRailPrimaryButton>
        </Menu.Target>
        <Menu.Dropdown>
          {specRecentPairs.map((pair) => (
            <Menu.Item
              key={`${pair.oldPath}::${pair.newPath}`}
              onClick={() =>
                void runRecentAction('Recent Spec compare', () => runSpecFromRecent(pair))
              }
            >
              {`${pair.oldPath} -> ${pair.newPath}`}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item color="red" onClick={() => setSpecRecentPairs([])}>
            Clear recent
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    ) : isCompareCentricMode && mode === 'text' ? (
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <HeaderRailPrimaryButton
            variant="default"
            leftSection={<IconHistory size={14} />}
            disabled={textRecentPairs.length === 0}
          >
            Recent
          </HeaderRailPrimaryButton>
        </Menu.Target>
        <Menu.Dropdown>
          {textRecentPairs.map((pair) => (
            <Menu.Item
              key={`${pair.oldPath}::${pair.newPath}`}
              onClick={() =>
                void runRecentAction('Recent Text compare', () => runTextFromRecentWithViewReset(pair))
              }
            >
              {`${pair.oldPath} -> ${pair.newPath}`}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item color="red" onClick={() => setTextRecentPairs([])}>
            Clear recent
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    ) : null

  const compareModeHeaderActions = isCompareCentricMode ? (
    <CompareModeHeaderActions
      loading={loading}
      compareDisabled={
        mode === 'json' ? jsonCompareDisabled : mode === 'spec' ? specCompareDisabled : false
      }
      onCompare={() => void onRun()}
      optionsOpen={compareOptionsOpened}
      onToggleOptions={() => setCompareOptionsOpened((prev) => !prev)}
      extraActions={compareRecentMenu}
    />
  ) : undefined
  const folderHeaderActions =
    mode === 'folder' ? (
      <HeaderRailGroup className="compare-mode-header-actions">
        <HeaderRailPrimaryButton
          onClick={() => void onRun()}
          loading={loading}
          disabled={!folderLeftRoot || !folderRightRoot}
          leftSection={<IconArrowsDiff size={14} />}
        >
          Compare
        </HeaderRailPrimaryButton>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <HeaderRailPrimaryButton
              variant="default"
              leftSection={<IconHistory size={14} />}
              disabled={folderRecentPairs.length === 0}
            >
              Recent roots
            </HeaderRailPrimaryButton>
          </Menu.Target>
          <Menu.Dropdown>
            {folderRecentPairs.map((entry) => (
              <Menu.Item
                key={`${entry.leftRoot}::${entry.rightRoot}::${entry.currentPath}::${entry.viewMode}`}
                onClick={() =>
                  void runRecentAction('Recent directory compare', () =>
                    runFolderFromRecent(entry),
                  )
                }
              >
                {`${entry.leftRoot} <> ${entry.rightRoot}`}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item color="red" onClick={() => setFolderRecentPairs([])}>
              Clear recent
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </HeaderRailGroup>
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
              onOldChange={(value) => {
                setJSONOldText(value)
                if (jsonOldSourcePath) setJSONOldSourcePath('')
              }}
              onNewChange={(value) => {
                setJSONNewText(value)
                if (jsonNewSourcePath) setJSONNewSourcePath('')
              }}
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
              onOldChange={(value) => {
                setSpecOldText(value)
                if (specOldSourcePath) setSpecOldSourcePath('')
              }}
              onNewChange={(value) => {
                setSpecNewText(value)
                if (specNewSourcePath) setSpecNewSourcePath('')
              }}
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
