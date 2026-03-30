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
  IconBackspace,
  IconChevronDown,
  IconClipboardText,
  IconCopy,
  IconFolderOpen,
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
  DesktopRecentScenarioPath,
  DesktopState,
  FolderCompareItem,
  LoadTextFileRequest,
  LoadTextFileResponse,
  Mode,
  ScenarioCheckListEntry,
  ScenarioListResponse,
  ScenarioResult,
  ScenarioRunResponse,
} from './types'
import './style.css'
import { AppChrome } from './ui/AppChrome'
import { StatusBadge } from './ui/StatusBadge'
import { CompareWorkspaceShell } from './ui/CompareWorkspaceShell'
import { CompareSourceGrid } from './ui/CompareSourceGrid'
import { CompareSourcePane } from './ui/CompareSourcePane'
import {
  ComparePaneAction,
  ComparePaneActions,
} from './ui/CompareSourceActions'
import { CompareStatusState } from './ui/CompareStatusState'
import { CompareModeHeaderActions } from './ui/CompareModeHeaderActions'
import { HeaderRailGroup, HeaderRailPrimaryButton } from './ui/HeaderRail'
import { CompareTextInputBody } from './ui/CompareTextInputBody'
import { CompareCodeInputBody } from './ui/CompareCodeInputBody'
import {
  upsertRecentFolderPair,
  upsertRecentPair,
  upsertRecentScenarioPath,
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
  type FolderViewMode,
} from './features/folder/folderTree'
import { DirectoryCompareResultPanel } from './features/folder/DirectoryCompareResultPanel'
import { useDirectoryCompareViewState } from './features/folder/useDirectoryCompareViewState'
import { useTextDiffViewState } from './features/text/useTextDiffViewState'
import { TextCompareResultPanel } from './features/text/TextCompareResultPanel'
import { useJSONCompareViewState } from './features/json/useJSONCompareViewState'
import { JSONCompareResultPanel } from './features/json/JSONCompareResultPanel'
import { useSpecCompareViewState } from './features/spec/useSpecCompareViewState'
import { SpecCompareResultPanel } from './features/spec/SpecCompareResultPanel'

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
type FolderReturnContext = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  selectedPath: string
  viewMode: FolderViewMode
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

function chooseInitialScenarioResult(res: ScenarioRunResponse): string {
  const results = res.results ?? []
  if (results.length === 0) return ''

  const firstNonOK = results.find((r) => r.status !== 'ok')
  if (firstNonOK) return firstNonOK.name

  return results[0].name
}

function classForStatus(status: string): string {
  if (status === 'ok' || status === 'diff' || status === 'error') return status
  return 'error'
}

function toneForScenarioStatus(status: string): 'success' | 'warning' | 'danger' {
  if (status === 'ok') return 'success'
  if (status === 'diff') return 'warning'
  return 'danger'
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

  const [textOld, setTextOld] = useState('')
  const [textNew, setTextNew] = useState('')
  const [textOldSourcePath, setTextOldSourcePath] = useState('')
  const [textNewSourcePath, setTextNewSourcePath] = useState('')
  const [textCommon, setTextCommon] = useState<CompareCommon>(defaultTextCommon)
  const [textResult, setTextResult] = useState<CompareResponse | null>(null)
  const [textLastRunOld, setTextLastRunOld] = useState('')
  const [textLastRunNew, setTextLastRunNew] = useState('')
  const [textLastRunOutputFormat, setTextLastRunOutputFormat] = useState<
    'text' | 'json' | null
  >(null)
  const [textClipboardBusyTarget, setTextClipboardBusyTarget] =
    useState<TextInputTarget | null>(null)
  const [textFileBusyTarget, setTextFileBusyTarget] = useState<TextInputTarget | null>(
    null,
  )
  const [textCopyBusy, setTextCopyBusy] = useState(false)
  const [textPaneCopyBusyTarget, setTextPaneCopyBusyTarget] = useState<TextInputTarget | null>(
    null,
  )

  const textEditorBusy = textClipboardBusyTarget !== null || textFileBusyTarget !== null

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
  const [folderOpenBusyPath, setFolderOpenBusyPath] = useState('')
  const [folderReturnContext, setFolderReturnContext] = useState<FolderReturnContext | null>(
    null,
  )
  const [folderRecentPairs, setFolderRecentPairs] = useState<DesktopRecentFolderPair[]>([])

  const [scenarioPath, setScenarioPath] = useState('')
  const [reportFormat, setReportFormat] = useState<'text' | 'json'>('text')
  const [scenarioChecks, setScenarioChecks] = useState<ScenarioCheckListEntry[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])
  const [scenarioListStatus, setScenarioListStatus] = useState('')
  const [scenarioRunResult, setScenarioRunResult] = useState<ScenarioRunResponse | null>(null)
  const [selectedScenarioResultName, setSelectedScenarioResultName] = useState('')
  const [scenarioRecentPaths, setScenarioRecentPaths] = useState<DesktopRecentScenarioPath[]>(
    [],
  )

  const [jsonRecentPairs, setJSONRecentPairs] = useState<DesktopRecentPair[]>([])
  const [specRecentPairs, setSpecRecentPairs] = useState<DesktopRecentPair[]>([])
  const [textRecentPairs, setTextRecentPairs] = useState<DesktopRecentPair[]>([])
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

  useEffect(() => {
    if (mode !== 'folder') {
      return
    }
    if (!folderResult) {
      return
    }
    if (!folderLeftRoot || !folderRightRoot) {
      return
    }
    const resultPath = folderResult.currentPath ?? ''
    if (resultPath === folderCurrentPath) {
      return
    }

    void runFolderCompare(folderCurrentPath)
  }, [mode, folderResult, folderCurrentPath, folderLeftRoot, folderRightRoot])

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

  const updateTextCommon = <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
    setTextCommon((prev) => ({ ...prev, [key]: value }))
  }

  const setScenarioRunResultView = (res: ScenarioRunResponse) => {
    setScenarioRunResult(res)
    setSelectedScenarioResultName(chooseInitialScenarioResult(res))
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

  const browseFolderRoot = async (target: 'left' | 'right') => {
    const picker = api.pickFolderRoot

    if (!picker) {
      setFolderStatus('Directory picker is not available.')
      notifications.show({
        title: 'Directory picker unavailable',
        message: 'Directory picker is not available.',
        color: 'red',
      })
      return
    }

    try {
      const selected = await picker()
      if (!selected) {
        return
      }

      if (target === 'left') {
        setFolderLeftRoot(selected)
      } else {
        setFolderRightRoot(selected)
      }

      setFolderCurrentPath('')
      setSelectedFolderItemPath('')
      setFolderResult(null)
      setFolderStatus('')
    } catch (error) {
      const message = `Failed to pick directory: ${formatUnknownError(error)}`
      setFolderStatus(message)
      notifications.show({
        title: 'Failed to pick directory',
        message,
        color: 'red',
      })
    }
  }

  const runFolderCompare = async (nextCurrentPath = folderCurrentPath) => {
    const fn = api.compareFolders
    if (!fn) throw new Error('Wails bridge not available (CompareFolders)')

    setFolderStatus('')

    const res: CompareFoldersResponse = await fn({
      leftRoot: folderLeftRoot,
      rightRoot: folderRightRoot,
      currentPath: nextCurrentPath,
      recursive: true,
      showSame: true,
      nameFilter: folderNameFilter,
    } satisfies CompareFoldersRequest)

    setFolderResult(res)
    setFolderCurrentPath(res.currentPath ?? nextCurrentPath)

    if (res.error) {
      setFolderStatus(res.error)
      return
    }
    setFolderStatus('')
    setFolderRecentPairs((prev) =>
      upsertRecentFolderPair(prev, {
        leftRoot: folderLeftRoot,
        rightRoot: folderRightRoot,
        currentPath: res.currentPath ?? nextCurrentPath,
        viewMode: folderViewMode,
        usedAt: nowISO(),
      }),
    )
  }

  const openFolderEntryDiff = async (entry: FolderCompareItem) => {
    if (!canOpenFolderItem(entry)) {
      return
    }

    setFolderReturnContext({
      leftRoot: folderLeftRoot,
      rightRoot: folderRightRoot,
      currentPath: folderCurrentPath,
      selectedPath: entry.relativePath,
      viewMode: folderViewMode,
    })
    setFolderOpenBusyPath(entry.relativePath)
    setFolderStatus('')

    try {
      if (entry.compareModeHint === 'json') {
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
        return
      }

      if (entry.compareModeHint === 'spec') {
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
        return
      }

      const loadText = api.loadTextFile
      const compareText = api.compareText
      if (!loadText || !compareText) {
        throw new Error('Wails bridge not available (LoadTextFile/CompareText)')
      }

      const [leftLoaded, rightLoaded] = await Promise.all([
        loadText({ path: entry.leftPath } satisfies LoadTextFileRequest),
        loadText({ path: entry.rightPath } satisfies LoadTextFileRequest),
      ])

      const oldText = leftLoaded.content
      const newText = rightLoaded.content

      const res: CompareResponse = await compareText({
        oldText,
        newText,
        common: textCommon,
      })

      setTextOld(oldText)
      setTextNew(newText)
      setTextOldSourcePath(leftLoaded.path)
      setTextNewSourcePath(rightLoaded.path)
      setTextResult(res)
      setTextLastRunOld(oldText)
      setTextLastRunNew(newText)
      setTextLastRunOutputFormat(textCommon.outputFormat === 'json' ? 'json' : 'text')
      clearTextExpandedSections()
      resetTextSearch()
      setTextRecentPairs((prev) =>
        upsertRecentPair(prev, {
          oldPath: leftLoaded.path,
          newPath: rightLoaded.path,
          usedAt: nowISO(),
        }),
      )
      setMode('text')
      setResult(res)
    } catch (error) {
      const message = `Failed to open diff: ${formatUnknownError(error)}`
      setFolderStatus(message)
      notifications.show({
        title: 'Failed to open child diff',
        message,
        color: 'red',
      })
    } finally {
      setFolderOpenBusyPath('')
    }
  }

  const returnToFolderCompare = () => {
    if (folderReturnContext) {
      setFolderLeftRoot(folderReturnContext.leftRoot)
      setFolderRightRoot(folderReturnContext.rightRoot)
      setFolderCurrentPath(folderReturnContext.currentPath)
      setSelectedFolderItemPath(folderReturnContext.selectedPath)
      setFolderViewMode(folderReturnContext.viewMode)
    }
    setMode('folder')
  }

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

  const runText = async () => {
    const fn = api.compareText
    if (!fn) throw new Error('Wails bridge not available (CompareText)')
    clearTextExpandedSections()

    const res: CompareResponse = await fn({
      oldText: textOld,
      newText: textNew,
      common: textCommon,
    })
    setTextResult(res)
    setTextLastRunOld(textOld)
    setTextLastRunNew(textNew)
    setTextLastRunOutputFormat(textCommon.outputFormat === 'json' ? 'json' : 'text')
    setResult(res)
    if (textOldSourcePath.trim() && textNewSourcePath.trim()) {
      setTextRecentPairs((prev) =>
        upsertRecentPair(prev, {
          oldPath: textOldSourcePath,
          newPath: textNewSourcePath,
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

  const runTextFromRecent = async (pair: DesktopRecentPair) => {
    const loader = api.loadTextFile
    const compareText = api.compareText
    if (!loader || !compareText) {
      throw new Error('Wails bridge not available (LoadTextFile/CompareText)')
    }

    const [oldLoaded, newLoaded] = await Promise.all([
      loader({ path: pair.oldPath } satisfies LoadTextFileRequest),
      loader({ path: pair.newPath } satisfies LoadTextFileRequest),
    ])

    const res: CompareResponse = await compareText({
      oldText: oldLoaded.content,
      newText: newLoaded.content,
      common: textCommon,
    })

    setMode('text')
    setTextOldSourcePath(oldLoaded.path)
    setTextNewSourcePath(newLoaded.path)
    setTextOld(oldLoaded.content)
    setTextNew(newLoaded.content)
    setTextResult(res)
    setTextLastRunOld(oldLoaded.content)
    setTextLastRunNew(newLoaded.content)
    setTextLastRunOutputFormat(textCommon.outputFormat === 'json' ? 'json' : 'text')
    clearTextExpandedSections()
    resetTextSearch()
    setResult(res)
    setTextRecentPairs((prev) =>
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

  const loadScenarioRecent = async (entry: DesktopRecentScenarioPath) => {
    const fn = api.listScenarioChecks
    if (!fn) {
      throw new Error('Wails bridge not available (ListScenarioChecks)')
    }

    const path = entry.path
    const nextReportFormat = entry.reportFormat === 'json' ? 'json' : 'text'
    const res: ScenarioListResponse = await fn({
      scenarioPath: path,
      reportFormat: nextReportFormat,
      only: [],
    })

    setMode('scenario')
    setScenarioPath(path)
    setReportFormat(nextReportFormat)
    if (res.error) {
      setScenarioChecks([])
      setSelectedChecks([])
      setScenarioListStatus(res.error)
      return
    }

    setScenarioChecks(res.checks ?? [])
    setSelectedChecks([])
    setScenarioListStatus(`loaded ${res.checks?.length ?? 0} checks`)
    setScenarioRecentPaths((prev) =>
      upsertRecentScenarioPath(prev, {
        path,
        reportFormat: nextReportFormat,
        usedAt: nowISO(),
      }),
    )
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

  const pasteTextFromClipboard = async (target: TextInputTarget) => {
    const readClipboard = getRuntimeClipboardRead()
    if (!readClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    setTextClipboardBusyTarget(target)

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
        setTextOld(pasted)
        setTextOldSourcePath('')
      } else {
        setTextNew(pasted)
        setTextNewSourcePath('')
      }
    } catch (error) {
      const message = `Failed to read clipboard: ${formatUnknownError(error)}`
      notifications.show({
        title: 'Failed to paste from clipboard',
        message,
        color: 'red',
      })
    } finally {
      setTextClipboardBusyTarget(null)
    }
  }

  const loadTextFromFile = async (target: TextInputTarget) => {
    const picker = api.pickTextFile
    const loader = api.loadTextFile

    if (!picker || !loader) {
      notifications.show({
        title: 'Text loader unavailable',
        message: 'Text file loader is not available.',
        color: 'red',
      })
      return
    }

    setTextFileBusyTarget(target)

    try {
      const selected = await picker()
      if (!selected) {
        return
      }

      const loaded: LoadTextFileResponse = await loader({
        path: selected,
      } satisfies LoadTextFileRequest)

      if (target === 'old') {
        setTextOld(loaded.content)
        setTextOldSourcePath(loaded.path)
      } else {
        setTextNew(loaded.content)
        setTextNewSourcePath(loaded.path)
      }
    } catch (error) {
      const message = `Failed to load text file: ${formatUnknownError(error)}`
      notifications.show({
        title: 'Failed to load text file',
        message,
        color: 'red',
      })
    } finally {
      setTextFileBusyTarget(null)
    }
  }

  const clearTextInput = (target: TextInputTarget) => {
    if (target === 'old') {
      setTextOld('')
      setTextOldSourcePath('')
      return
    }

    setTextNew('')
    setTextNewSourcePath('')
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

  const copyTextResultRawOutput = async () => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    const raw = textResult ? renderResult(textResult) : ''
    if (!raw) {
      return
    }

    setTextCopyBusy(true)

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
      setTextCopyBusy(false)
    }
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

  const copyTextInput = async (target: TextInputTarget) => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    const value = target === 'old' ? textOld : textNew
    if (!value) {
      return
    }

    setTextPaneCopyBusyTarget(target)

    try {
      const ok = await writeClipboard(value)
      if (!ok) {
        notifications.show({
          title: 'Copy failed',
          message: `Failed to copy ${target === 'old' ? 'Old' : 'New'} text.`,
          color: 'red',
        })
        return
      }

      notifications.show({
        title: 'Copied',
        message: `${target === 'old' ? 'Old' : 'New'} text copied to clipboard.`,
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Copy failed',
        message: `Failed to copy text: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setTextPaneCopyBusyTarget(null)
    }
  }

  const loadScenarioChecks = async () => {
    const fn = api.listScenarioChecks
    if (!fn) throw new Error('Wails bridge not available (ListScenarioChecks)')

    const res: ScenarioListResponse = await fn({
      scenarioPath,
      reportFormat,
      only: [],
    })

    if (res.error) {
      setScenarioChecks([])
      setSelectedChecks([])
      setScenarioListStatus(res.error)
      return
    }

    setScenarioChecks(res.checks ?? [])
    setSelectedChecks([])
    setScenarioListStatus(`loaded ${res.checks?.length ?? 0} checks`)
    if (scenarioPath.trim()) {
      setScenarioRecentPaths((prev) =>
        upsertRecentScenarioPath(prev, {
          path: scenarioPath,
          reportFormat,
          usedAt: nowISO(),
        }),
      )
    }
  }

  const runScenario = async () => {
    const fn = api.runScenario
    if (!fn) throw new Error('Wails bridge not available (RunScenario)')

    const res: ScenarioRunResponse = await fn({
      scenarioPath,
      reportFormat,
      only: selectedChecks,
    })

    setScenarioRunResultView(res)
    setSummaryLine('')
    setOutput('')
    if (!res.error && scenarioPath.trim()) {
      setScenarioRecentPaths((prev) =>
        upsertRecentScenarioPath(prev, {
          path: scenarioPath,
          reportFormat,
          usedAt: nowISO(),
        }),
      )
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
        const errorText = String(e)
        setScenarioRunResult({
          exitCode: 2,
          error: errorText,
        })
        setSelectedScenarioResultName('')
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

  const onLoadScenarioChecks = async () => {
    setLoading(true)

    try {
      await loadScenarioChecks()
    } catch (e) {
      setScenarioChecks([])
      setSelectedChecks([])
      setScenarioListStatus(String(e))
    } finally {
      setLoading(false)
    }
  }

  const toggleScenarioCheck = (name: string, checked: boolean) => {
    setSelectedChecks((prev) => {
      if (checked) {
        if (prev.includes(name)) return prev
        return [...prev, name]
      }
      return prev.filter((v) => v !== name)
    })
  }

  const selectAllScenarioChecks = () => {
    setSelectedChecks(scenarioChecks.map((c) => c.name))
  }

  const clearScenarioSelection = () => {
    setSelectedChecks([])
  }

  const getSelectedScenarioResult = (): ScenarioResult | null => {
    if (!scenarioRunResult?.results || !selectedScenarioResultName) return null
    return scenarioRunResult.results.find((r) => r.name === selectedScenarioResultName) ?? null
  }

  const renderScenarioResultPanel = () => {
    if (!scenarioRunResult) {
      return <div className="muted">(no scenario run yet)</div>
    }

    if (scenarioRunResult.error) {
      return (
        <div className="scenario-result-detail">
          <StatusBadge tone="danger">error</StatusBadge>
          <pre>{scenarioRunResult.error}</pre>
        </div>
      )
    }

    const summary = scenarioRunResult.summary
    const results = scenarioRunResult.results ?? []
    const selected =
      getSelectedScenarioResult() ??
      results.find((r) => r.status !== 'ok') ??
      results[0] ??
      null

    return (
      <div className="scenario-result-shell">
        {summary ? (
          <div className="scenario-summary-grid">
            <div>
              <strong>exit</strong> {summary.exitCode}
            </div>
            <div>
              <strong>total</strong> {summary.total}
            </div>
            <div>
              <strong>ok</strong> {summary.ok}
            </div>
            <div>
              <strong>diff</strong> {summary.diff}
            </div>
            <div>
              <strong>error</strong> {summary.error}
            </div>
          </div>
        ) : null}

        <div className="scenario-results-layout">
          <div className="scenario-results-list">
            {results.map((r) => (
              <button
                key={r.name}
                className={`scenario-result-item ${selected?.name === r.name ? 'active' : ''}`}
                onClick={() => setSelectedScenarioResultName(r.name)}
                type="button"
              >
                <div className="scenario-result-item-top">
                  <span>{r.name}</span>
                  <StatusBadge tone={toneForScenarioStatus(classForStatus(r.status))}>
                    {r.status}
                  </StatusBadge>
                </div>
                <div className="scenario-result-item-sub">
                  <span>{r.kind}</span>
                  <span>exit={r.exitCode}</span>
                  <span>diff={r.diffFound ? 'yes' : 'no'}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="scenario-result-detail">
            {selected ? (
              <>
                <h3>{selected.name}</h3>
                <div className="muted">
                  {selected.kind} · status={selected.status} · exit={selected.exitCode} · diff={selected.diffFound ? 'yes' : 'no'}
                </div>
                {selected.errorMessage ? <pre>{selected.errorMessage}</pre> : null}
                {selected.output ? <pre>{selected.output}</pre> : null}
                {!selected.errorMessage && !selected.output ? (
                  <div className="muted">(no detail)</div>
                ) : null}
              </>
            ) : (
              <div className="muted">(no selected result)</div>
            )}
          </div>
        </div>
      </div>
    )
  }

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
                void runRecentAction('Recent Text compare', () => runTextFromRecent(pair))
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
      <section className="mode-panel">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={ignoreOrder}
            onChange={(e) => setIgnoreOrder(e.target.checked)}
          />
          ignore array order
        </label>

        <section className="options-panel">
          <h3>Options</h3>

          <div className="field-block">
            <label className="field-label">Output format</label>
            <select
              value={jsonCommon.outputFormat}
              onChange={(e) => updateJSONCommon('outputFormat', e.target.value)}
            >
              <option value="text">text</option>
              <option value="json">json</option>
            </select>
          </div>

          <div className="field-block">
            <label className="field-label">Text style</label>
            <select
              value={jsonCommon.textStyle}
              disabled={jsonCommon.outputFormat === 'json'}
              onChange={(e) => updateJSONCommon('textStyle', e.target.value)}
            >
              <option value="auto">auto</option>
              <option value="patch" disabled={jsonPatchBlockedByFilters}>
                patch
              </option>
              <option value="semantic">semantic</option>
            </select>
          </div>
        </section>

        <details className="advanced-panel" open>
          <summary className="advanced-summary">Advanced options</summary>

          <div className="field-block">
            <label className="field-label">Fail on</label>
            <select
              value={jsonCommon.failOn}
              onChange={(e) => updateJSONCommon('failOn', e.target.value)}
            >
              <option value="none">none</option>
              <option value="breaking">breaking</option>
              <option value="any">any</option>
            </select>
          </div>

          <div className="field-block">
            <label className="field-label">Ignore paths</label>
            <textarea
              className="ignore-paths-input"
              value={jsonIgnorePathsDraft}
              onChange={(e) => setJSONIgnorePathsDraft(e.target.value)}
              onBlur={(e) =>
                updateJSONCommon('ignorePaths', parseIgnorePaths(e.target.value))
              }
              placeholder={'user.updated_at\nmeta.request_id'}
            />
            <div className="helper-text">
              Enter one canonical path per line (exact match), e.g. <code>user.updated_at</code>.
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={jsonCommon.showPaths}
              onChange={(e) => updateJSONCommon('showPaths', e.target.checked)}
            />
            show canonical paths
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={jsonCommon.onlyBreaking}
              onChange={(e) => updateJSONCommon('onlyBreaking', e.target.checked)}
            />
            only breaking
          </label>
        </details>
      </section>
    ) : mode === 'spec' ? (
      <section className="mode-panel">
        <section className="options-panel">
          <h3>Options</h3>

          <div className="field-block">
            <label className="field-label">Output format</label>
            <select
              value={specCommon.outputFormat}
              onChange={(e) => updateSpecCommon('outputFormat', e.target.value)}
            >
              <option value="text">text</option>
              <option value="json">json</option>
            </select>
          </div>

          <div className="field-block">
            <label className="field-label">Text style</label>
            <select
              value={specCommon.textStyle}
              disabled={specCommon.outputFormat === 'json'}
              onChange={(e) => updateSpecCommon('textStyle', e.target.value)}
            >
              <option value="auto">auto</option>
              <option value="semantic">semantic</option>
            </select>
          </div>
        </section>

        <details className="advanced-panel" open>
          <summary className="advanced-summary">Advanced options</summary>

          <div className="field-block">
            <label className="field-label">Fail on</label>
            <select
              value={specCommon.failOn}
              onChange={(e) => updateSpecCommon('failOn', e.target.value)}
            >
              <option value="none">none</option>
              <option value="breaking">breaking</option>
              <option value="any">any</option>
            </select>
          </div>

          <div className="field-block">
            <label className="field-label">Ignore paths</label>
            <textarea
              className="ignore-paths-input"
              value={specIgnorePathsDraft}
              onChange={(e) => setSpecIgnorePathsDraft(e.target.value)}
              onBlur={(e) =>
                updateSpecCommon('ignorePaths', parseIgnorePaths(e.target.value))
              }
              placeholder={'paths./users.post.requestBody.required'}
            />
            <div className="helper-text">
              Enter one canonical path per line (exact match), e.g.{' '}
              <code>paths./users.post.requestBody.required</code>.
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={specCommon.showPaths}
              onChange={(e) => updateSpecCommon('showPaths', e.target.checked)}
            />
            show canonical paths
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={specCommon.onlyBreaking}
              onChange={(e) => updateSpecCommon('onlyBreaking', e.target.checked)}
            />
            only breaking
          </label>
        </details>
      </section>
    ) : (
      <section className="mode-panel">
        <section className="options-panel">
          <h3>Options</h3>

          <div className="field-block">
            <label className="field-label">Output format</label>
            <select
              value={textCommon.outputFormat}
              onChange={(e) => updateTextCommon('outputFormat', e.target.value)}
            >
              <option value="text">text</option>
              <option value="json">json</option>
            </select>
          </div>

          <div className="field-block">
            <label className="field-label">Fail on</label>
            <select
              value={textCommon.failOn}
              onChange={(e) => updateTextCommon('failOn', e.target.value)}
            >
              <option value="none">none</option>
              <option value="breaking">breaking</option>
              <option value="any">any</option>
            </select>
          </div>
        </section>
      </section>
    )

  const sidebarContent =
    mode === 'scenario' ? (
      <section className="mode-panel">
        <div className="field-block">
          <label className="field-label">Scenario path</label>
          <div className="path-row">
            <input value={scenarioPath} onChange={(e) => setScenarioPath(e.target.value)} />
            <button
              type="button"
              className="button-secondary"
              onClick={() => browseAndSet(api.pickScenarioFile, setScenarioPath)}
            >
              Browse...
            </button>
          </div>
          <div className="button-row">
            <Menu position="bottom-start" withinPortal>
              <Menu.Target>
                <button
                  type="button"
                  className="button-secondary button-compact"
                  disabled={scenarioRecentPaths.length === 0}
                >
                  Recent scenarios
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                {scenarioRecentPaths.map((entry) => (
                  <Menu.Item
                    key={`${entry.path}::${entry.reportFormat}`}
                    onClick={() =>
                      void runRecentAction('Recent scenario load', () =>
                        loadScenarioRecent(entry),
                      )
                    }
                  >
                    {entry.path} ({entry.reportFormat})
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Item color="red" onClick={() => setScenarioRecentPaths([])}>
                  Clear recent
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </div>

        <div className="field-block">
          <label className="field-label">Report format</label>
          <select
            value={reportFormat}
            onChange={(e) => setReportFormat(e.target.value as 'text' | 'json')}
          >
            <option value="text">text</option>
            <option value="json">json</option>
          </select>
        </div>

        <div className="button-row">
          <button className="button-secondary" onClick={onLoadScenarioChecks} disabled={loading}>
            {loading ? 'Loading...' : 'Load checks'}
          </button>
          <button className="button-primary" onClick={onRun} disabled={loading}>
            {loading ? 'Running...' : 'Run selected'}
          </button>
        </div>

        {scenarioListStatus ? <div className="muted">{scenarioListStatus}</div> : null}

        <div className="button-row">
          <button
            className="button-secondary button-compact"
            onClick={selectAllScenarioChecks}
            disabled={scenarioChecks.length === 0}
          >
            Select all
          </button>
          <button
            className="button-secondary button-compact"
            onClick={clearScenarioSelection}
            disabled={selectedChecks.length === 0}
          >
            Clear
          </button>
        </div>

        <div className="scenario-check-list">
          {scenarioChecks.length === 0 ? (
            <div className="muted">No checks loaded yet.</div>
          ) : (
            scenarioChecks.map((check) => (
              <label key={check.name} className="scenario-check-item">
                <input
                  type="checkbox"
                  checked={selectedChecks.includes(check.name)}
                  onChange={(e) => toggleScenarioCheck(check.name, e.target.checked)}
                />
                <div>
                  <div className="scenario-check-title">
                    {check.name} <span className="muted">({check.kind})</span>
                  </div>
                  <div className="scenario-check-summary">{check.summary}</div>
                </div>
              </label>
            ))
          )}
        </div>
      </section>
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
            <CompareSourceGrid
              left={
                <CompareSourcePane
                  title="Old text"
                  sourcePath={textOldSourcePath}
                  actions={
                    <ComparePaneActions>
                      <ComparePaneAction
                        label="Open file into Old text"
                        onClick={() => void loadTextFromFile('old')}
                        disabled={textEditorBusy}
                        loading={textFileBusyTarget === 'old'}
                      >
                        <IconFolderOpen size={14} />
                      </ComparePaneAction>
                      <ComparePaneAction
                        label="Paste clipboard into Old text"
                        onClick={() => void pasteTextFromClipboard('old')}
                        disabled={textEditorBusy}
                        loading={textClipboardBusyTarget === 'old'}
                      >
                        <IconClipboardText size={14} />
                      </ComparePaneAction>
                      <ComparePaneAction
                        label="Copy Old text"
                        onClick={() => void copyTextInput('old')}
                        disabled={textEditorBusy || !textOld}
                        loading={textPaneCopyBusyTarget === 'old'}
                      >
                        <IconCopy size={14} />
                      </ComparePaneAction>
                      <ComparePaneAction
                        label="Clear Old text"
                        onClick={() => clearTextInput('old')}
                        disabled={textEditorBusy || !textOld}
                        danger
                      >
                        <IconBackspace size={14} />
                      </ComparePaneAction>
                    </ComparePaneActions>
                  }
                >
                  <CompareTextInputBody
                    value={textOld}
                    onChange={(value) => {
                      setTextOld(value)
                      if (textOldSourcePath) setTextOldSourcePath('')
                    }}
                  />
                </CompareSourcePane>
              }
              right={
                <CompareSourcePane
                  title="New text"
                  sourcePath={textNewSourcePath}
                  actions={
                    <ComparePaneActions>
                      <ComparePaneAction
                        label="Open file into New text"
                        onClick={() => void loadTextFromFile('new')}
                        disabled={textEditorBusy}
                        loading={textFileBusyTarget === 'new'}
                      >
                        <IconFolderOpen size={14} />
                      </ComparePaneAction>
                      <ComparePaneAction
                        label="Paste clipboard into New text"
                        onClick={() => void pasteTextFromClipboard('new')}
                        disabled={textEditorBusy}
                        loading={textClipboardBusyTarget === 'new'}
                      >
                        <IconClipboardText size={14} />
                      </ComparePaneAction>
                      <ComparePaneAction
                        label="Copy New text"
                        onClick={() => void copyTextInput('new')}
                        disabled={textEditorBusy || !textNew}
                        loading={textPaneCopyBusyTarget === 'new'}
                      >
                        <IconCopy size={14} />
                      </ComparePaneAction>
                      <ComparePaneAction
                        label="Clear New text"
                        onClick={() => clearTextInput('new')}
                        disabled={textEditorBusy || !textNew}
                        danger
                      >
                        <IconBackspace size={14} />
                      </ComparePaneAction>
                    </ComparePaneActions>
                  }
                >
                  <CompareTextInputBody
                    value={textNew}
                    onChange={(value) => {
                      setTextNew(value)
                      if (textNewSourcePath) setTextNewSourcePath('')
                    }}
                  />
                </CompareSourcePane>
              }
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
          <CompareSourceGrid
            left={
              <CompareSourcePane
                title="Old JSON"
                sourcePath={jsonOldSourcePath}
                actions={
                  <ComparePaneActions>
                    <ComparePaneAction
                      label="Open file into Old JSON"
                      onClick={() => void loadJSONFromFile('old')}
                      disabled={jsonEditorBusy}
                      loading={jsonFileBusyTarget === 'old'}
                    >
                      <IconFolderOpen size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Paste clipboard into Old JSON"
                      onClick={() => void pasteJSONFromClipboard('old')}
                      disabled={jsonEditorBusy}
                      loading={jsonClipboardBusyTarget === 'old'}
                    >
                      <IconClipboardText size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Copy Old JSON"
                      onClick={() => void copyJSONInput('old')}
                      disabled={jsonEditorBusy || !jsonOldText}
                      loading={jsonCopyBusyTarget === 'old'}
                    >
                      <IconCopy size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Clear Old JSON"
                      onClick={() => clearJSONInput('old')}
                      disabled={jsonEditorBusy || !jsonOldText}
                      danger
                    >
                      <IconBackspace size={14} />
                    </ComparePaneAction>
                  </ComparePaneActions>
                }
              >
                <CompareCodeInputBody
                  value={jsonOldText}
                  onChange={(value) => {
                    setJSONOldText(value)
                    if (jsonOldSourcePath) setJSONOldSourcePath('')
                  }}
                  language="json"
                  parseError={jsonOldParseError}
                />
              </CompareSourcePane>
            }
            right={
              <CompareSourcePane
                title="New JSON"
                sourcePath={jsonNewSourcePath}
                actions={
                  <ComparePaneActions>
                    <ComparePaneAction
                      label="Open file into New JSON"
                      onClick={() => void loadJSONFromFile('new')}
                      disabled={jsonEditorBusy}
                      loading={jsonFileBusyTarget === 'new'}
                    >
                      <IconFolderOpen size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Paste clipboard into New JSON"
                      onClick={() => void pasteJSONFromClipboard('new')}
                      disabled={jsonEditorBusy}
                      loading={jsonClipboardBusyTarget === 'new'}
                    >
                      <IconClipboardText size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Copy New JSON"
                      onClick={() => void copyJSONInput('new')}
                      disabled={jsonEditorBusy || !jsonNewText}
                      loading={jsonCopyBusyTarget === 'new'}
                    >
                      <IconCopy size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Clear New JSON"
                      onClick={() => clearJSONInput('new')}
                      disabled={jsonEditorBusy || !jsonNewText}
                      danger
                    >
                      <IconBackspace size={14} />
                    </ComparePaneAction>
                  </ComparePaneActions>
                }
              >
                <CompareCodeInputBody
                  value={jsonNewText}
                  onChange={(value) => {
                    setJSONNewText(value)
                    if (jsonNewSourcePath) setJSONNewSourcePath('')
                  }}
                  language="json"
                  parseError={jsonNewParseError}
                />
              </CompareSourcePane>
            }
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
          <CompareSourceGrid
            left={
              <CompareSourcePane
                title="Old Spec"
                sourcePath={specOldSourcePath}
                actions={
                  <ComparePaneActions>
                    <ComparePaneAction
                      label="Open file into Old Spec"
                      onClick={() => void loadSpecFromFile('old')}
                      disabled={specEditorBusy}
                      loading={specFileBusyTarget === 'old'}
                    >
                      <IconFolderOpen size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Paste clipboard into Old Spec"
                      onClick={() => void pasteSpecFromClipboard('old')}
                      disabled={specEditorBusy}
                      loading={specClipboardBusyTarget === 'old'}
                    >
                      <IconClipboardText size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Copy Old Spec"
                      onClick={() => void copySpecInput('old')}
                      disabled={specEditorBusy || !specOldText}
                      loading={specCopyBusyTarget === 'old'}
                    >
                      <IconCopy size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Clear Old Spec"
                      onClick={() => clearSpecInput('old')}
                      disabled={specEditorBusy || !specOldText}
                      danger
                    >
                      <IconBackspace size={14} />
                    </ComparePaneAction>
                  </ComparePaneActions>
                }
              >
                <CompareCodeInputBody
                  value={specOldText}
                  onChange={(value) => {
                    setSpecOldText(value)
                    if (specOldSourcePath) setSpecOldSourcePath('')
                  }}
                  language={specOldLanguage}
                  parseError={specOldParseError}
                />
              </CompareSourcePane>
            }
            right={
              <CompareSourcePane
                title="New Spec"
                sourcePath={specNewSourcePath}
                actions={
                  <ComparePaneActions>
                    <ComparePaneAction
                      label="Open file into New Spec"
                      onClick={() => void loadSpecFromFile('new')}
                      disabled={specEditorBusy}
                      loading={specFileBusyTarget === 'new'}
                    >
                      <IconFolderOpen size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Paste clipboard into New Spec"
                      onClick={() => void pasteSpecFromClipboard('new')}
                      disabled={specEditorBusy}
                      loading={specClipboardBusyTarget === 'new'}
                    >
                      <IconClipboardText size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Copy New Spec"
                      onClick={() => void copySpecInput('new')}
                      disabled={specEditorBusy || !specNewText}
                      loading={specCopyBusyTarget === 'new'}
                    >
                      <IconCopy size={14} />
                    </ComparePaneAction>
                    <ComparePaneAction
                      label="Clear New Spec"
                      onClick={() => clearSpecInput('new')}
                      disabled={specEditorBusy || !specNewText}
                      danger
                    >
                      <IconBackspace size={14} />
                    </ComparePaneAction>
                  </ComparePaneActions>
                }
              >
                <CompareCodeInputBody
                  value={specNewText}
                  onChange={(value) => {
                    setSpecNewText(value)
                    if (specNewSourcePath) setSpecNewSourcePath('')
                  }}
                  language={specNewLanguage}
                  parseError={specNewParseError}
                />
              </CompareSourcePane>
            }
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
