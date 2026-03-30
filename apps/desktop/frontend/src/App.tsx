import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
} from 'react'
import { ActionIcon, Menu, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import YAML from 'yaml'
import {
  IconArrowLeft,
  IconArrowsDiff,
  IconBackspace,
  IconBinaryTree2,
  IconChevronRight,
  IconChevronDown,
  IconClipboardText,
  IconCopy,
  IconFile,
  IconFolderOpen,
  IconHistory,
  IconList,
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
  JSONRichDiffItem,
  LoadTextFileRequest,
  LoadTextFileResponse,
  Mode,
  ScenarioCheckListEntry,
  ScenarioListResponse,
  SpecRichDiffItem,
  ScenarioResult,
  ScenarioRunResponse,
} from './types'
import './style.css'
import { AppChrome } from './ui/AppChrome'
import { SectionCard } from './ui/SectionCard'
import { StatusBadge } from './ui/StatusBadge'
import { CompareResultToolbar } from './ui/CompareResultToolbar'
import { CompareSearchControls } from './ui/CompareSearchControls'
import {
  CompareStatusBadges,
  type CompareStatusBadgeItem,
} from './ui/CompareStatusBadges'
import { ViewSettingsMenu } from './ui/ViewSettingsMenu'
import { CompareWorkspaceShell } from './ui/CompareWorkspaceShell'
import { CompareSourceGrid } from './ui/CompareSourceGrid'
import { CompareSourcePane } from './ui/CompareSourcePane'
import { CompareResultShell } from './ui/CompareResultShell'
import { CompareSectionHeader } from './ui/CompareSectionHeader'
import { CompareValueBlock } from './ui/CompareValueBlock'
import {
  ComparePaneAction,
  ComparePaneActions,
} from './ui/CompareSourceActions'
import { CompareStatusState } from './ui/CompareStatusState'
import { CompareModeHeaderActions } from './ui/CompareModeHeaderActions'
import { HeaderRailGroup, HeaderRailPrimaryButton } from './ui/HeaderRail'
import { CompareTextInputBody } from './ui/CompareTextInputBody'
import { CompareCodeInputBody } from './ui/CompareCodeInputBody'
import { SpecRichDiffViewer } from './ui/SpecRichDiffViewer'
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
  buildFolderBreadcrumbs,
  canOpenFolderItem,
  filterFolderItemsByQuickFilter,
  filterFolderTreeNodesByQuickFilter,
  flattenFolderTreeRows,
  folderItemsToTreeNodes,
  folderQuickFilterLabel,
  folderStatusSortRank,
  formatFolderKindLabel,
  formatFolderSide,
  formatFolderStatusLabel,
  getFolderItemActionReason,
  toneForFolderStatus,
  toggleFolderSort,
  type FolderQuickFilter,
  type FolderSortDirection,
  type FolderSortKey,
  type FolderTreeNode,
  type FolderTreeRow,
  type FolderViewMode,
} from './features/folder/folderTree'
import {
  buildExpandedContextRow,
  buildRichDiffItems,
  buildTextSearchMatches,
  buildTextSearchRowIDForItem,
  buildTextSearchRowIDForOmitted,
  normalizeSearchQuery,
  parseUnifiedDiff,
  shouldHideTextRichMetaRow,
  shouldShowTextHunkHeaders,
  type RichDiffItem,
  type UnifiedDiffRow,
} from './features/text/textDiff'
import { useTextDiffViewState } from './features/text/useTextDiffViewState'
import { TextCompareResultPanel } from './features/text/TextCompareResultPanel'

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
type JSONDiffGroup = {
  key: string
  items: JSONRichDiffItem[]
  summary: {
    added: number
    removed: number
    changed: number
    typeChanged: number
    breaking: number
  }
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

function buildJSONSummaryBadgeItems(params: {
  hasResult: boolean
  hasError: boolean
  diffFound: boolean
  added: number
  removed: number
  changed: number
  typeChanged: number
  breaking: number
}): CompareStatusBadgeItem[] {
  if (!params.hasResult) {
    return []
  }

  if (params.hasError) {
    return [{ key: 'error', label: 'Execution error', tone: 'error' }]
  }

  if (!params.diffFound) {
    return [{ key: 'none', label: 'No differences', tone: 'neutral' }]
  }

  const items: CompareStatusBadgeItem[] = []
  if (params.added > 0) {
    items.push({ key: 'added', label: `+${params.added}`, tone: 'added' })
  }
  if (params.removed > 0) {
    items.push({ key: 'removed', label: `-${params.removed}`, tone: 'removed' })
  }
  if (params.changed > 0) {
    items.push({ key: 'changed', label: `~${params.changed}`, tone: 'changed' })
  }
  if (params.typeChanged > 0) {
    items.push({
      key: 'typeChanged',
      label: `type ${params.typeChanged}`,
      tone: 'breaking',
    })
  }
  if (params.breaking > 0) {
    items.push({ key: 'breaking', label: `breaking ${params.breaking}`, tone: 'breaking' })
  }
  return items
}

function buildSpecSummaryBadgeItems(params: {
  hasResult: boolean
  hasError: boolean
  diffFound: boolean
  added: number
  removed: number
  changed: number
  typeChanged: number
  breaking: number
}): CompareStatusBadgeItem[] {
  if (!params.hasResult) {
    return []
  }

  if (params.hasError) {
    return [{ key: 'error', label: 'Execution error', tone: 'error' }]
  }

  if (!params.diffFound) {
    return [{ key: 'none', label: 'No differences', tone: 'neutral' }]
  }

  const items: CompareStatusBadgeItem[] = []
  if (params.added > 0) {
    items.push({ key: 'added', label: `+${params.added}`, tone: 'added' })
  }
  if (params.removed > 0) {
    items.push({ key: 'removed', label: `-${params.removed}`, tone: 'removed' })
  }
  if (params.changed > 0) {
    items.push({ key: 'changed', label: `~${params.changed}`, tone: 'changed' })
  }
  if (params.typeChanged > 0) {
    items.push({
      key: 'typeChanged',
      label: `type ${params.typeChanged}`,
      tone: 'breaking',
    })
  }
  if (params.breaking > 0) {
    items.push({ key: 'breaking', label: `breaking ${params.breaking}`, tone: 'breaking' })
  }
  return items
}

function stringifyJSONValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
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

function summarizeJSONSearchText(item: JSONRichDiffItem): string {
  return `${item.path}\n${stringifyJSONValue(item.oldValue)}\n${stringifyJSONValue(item.newValue)}`
}

function summarizeSpecSearchText(item: SpecRichDiffItem): string {
  return `${item.label}\n${item.path}\n${stringifyJSONValue(item.oldValue)}\n${stringifyJSONValue(item.newValue)}`
}

function getJSONDiffGroupKey(path: string): string {
  if (!path) {
    return '(root)'
  }

  const dotIndex = path.indexOf('.')
  const bracketIndex = path.indexOf('[')
  const cutIndexes = [dotIndex, bracketIndex].filter((index) => index >= 0)
  if (cutIndexes.length === 0) {
    return path
  }

  const cutAt = Math.min(...cutIndexes)
  return path.slice(0, cutAt) || '(root)'
}

function buildJSONDiffGroups(diffs: JSONRichDiffItem[]): JSONDiffGroup[] {
  const map = new Map<string, JSONDiffGroup>()

  for (const diff of diffs) {
    const key = getJSONDiffGroupKey(diff.path)
    const group =
      map.get(key) ?? {
        key,
        items: [],
        summary: { added: 0, removed: 0, changed: 0, typeChanged: 0, breaking: 0 },
      }

    group.items.push(diff)
    if (diff.type === 'added') group.summary.added++
    else if (diff.type === 'removed') group.summary.removed++
    else if (diff.type === 'changed') group.summary.changed++
    else if (diff.type === 'type_changed') group.summary.typeChanged++
    if (diff.breaking) group.summary.breaking++

    map.set(key, group)
  }

  return [...map.values()]
}

function buildJSONMatchGroupKeys(diffs: JSONRichDiffItem[], matchIndexes: number[]): string[] {
  const keys = new Set<string>()
  for (const index of matchIndexes) {
    const diff = diffs[index]
    if (!diff) continue
    keys.add(getJSONDiffGroupKey(diff.path))
  }
  return [...keys]
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

function renderInlineDiffContent(row: UnifiedDiffRow, keyBase: string) {
  if (!row.inlineSegments || row.inlineSegments.length === 0) {
    return row.content
  }

  return row.inlineSegments.map((segment, index) => {
    const className =
      segment.kind === 'same'
        ? undefined
        : segment.kind === 'add'
          ? 'text-inline-add'
          : 'text-inline-remove'

    return (
      <span key={`${keyBase}-${index}`} className={className}>
        {segment.text}
      </span>
    )
  })
}

function renderSplitDiffCell(
  row: UnifiedDiffRow | null,
  side: 'left' | 'right',
  keyBase: string,
  searchClassName = '',
  rowRef?: (node: HTMLDivElement | null) => void,
) {
  const lineNumber = side === 'left' ? row?.oldLine : row?.newLine
  const kindClass = row?.kind ?? 'empty'

  return (
    <div
      ref={rowRef}
      className={['split-diff-cell', kindClass, searchClassName].filter(Boolean).join(' ')}
    >
      <div className="split-diff-line">{lineNumber ?? ''}</div>
      <pre className="split-diff-content">
        {row ? renderInlineDiffContent(row, keyBase) : ''}
      </pre>
    </div>
  )
}

export function App() {
  const [mode, setMode] = useState<Mode>(() => getInitialMode())

  const [jsonOldText, setJSONOldText] = useState('')
  const [jsonNewText, setJSONNewText] = useState('')
  const [jsonOldSourcePath, setJSONOldSourcePath] = useState('')
  const [jsonNewSourcePath, setJSONNewSourcePath] = useState('')
  const [ignoreOrder, setIgnoreOrder] = useState(false)
  const [jsonCommon, setJSONCommon] = useState<CompareCommon>(defaultJSONCommon)
  const [jsonResultView, setJSONResultView] = useState<StructuredResultView>('diff')
  const [jsonRichResult, setJSONRichResult] = useState<CompareJSONRichResponse | null>(null)
  const [jsonSearchQuery, setJSONSearchQuery] = useState('')
  const [jsonActiveSearchIndex, setJSONActiveSearchIndex] = useState(0)
  const [jsonExpandedGroups, setJSONExpandedGroups] = useState<string[]>([])
  const [jsonExpandedValueKeys, setJSONExpandedValueKeys] = useState<string[]>([])
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
  const [specResultView, setSpecResultView] = useState<StructuredResultView>('diff')
  const [specRichResult, setSpecRichResult] = useState<CompareSpecRichResponse | null>(null)
  const [specSearchQuery, setSpecSearchQuery] = useState('')
  const [specActiveSearchIndex, setSpecActiveSearchIndex] = useState(0)
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
  const jsonDiffSearchRowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const specDiffSearchRowRefs = useRef<Record<string, HTMLDivElement | null>>({})
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
    isTextSearchMatchId,
    registerTextSearchRowRef,
    getTextSearchClassName,
    moveTextSearch,
    toggleTextUnchangedSection,
    toggleAllTextUnchangedSections,
  } = useTextDiffViewState({
    textResult,
    textLastRunOld,
    textLastRunNew,
    textLastRunOutputFormat,
  })

  const [folderLeftRoot, setFolderLeftRoot] = useState('')
  const [folderRightRoot, setFolderRightRoot] = useState('')
  const [folderNameFilter, setFolderNameFilter] = useState('')
  const [folderCurrentPath, setFolderCurrentPath] = useState('')
  const [folderResult, setFolderResult] = useState<CompareFoldersResponse | null>(null)
  const [folderStatus, setFolderStatus] = useState('')
  const [folderOpenBusyPath, setFolderOpenBusyPath] = useState('')
  const [folderQuickFilter, setFolderQuickFilter] = useState<FolderQuickFilter>('all')
  const [selectedFolderItemPath, setSelectedFolderItemPath] = useState('')
  const [folderReturnContext, setFolderReturnContext] = useState<FolderReturnContext | null>(
    null,
  )
  const [folderSortKey, setFolderSortKey] = useState<FolderSortKey>('name')
  const [folderSortDirection, setFolderSortDirection] = useState<FolderSortDirection>('asc')
  const [folderViewMode, setFolderViewMode] = useState<FolderViewMode>('list')
  const [folderTreeRoots, setFolderTreeRoots] = useState<FolderTreeNode[]>([])
  const [folderExpandedPaths, setFolderExpandedPaths] = useState<string[]>([])
  const [folderTreeLoadingPath, setFolderTreeLoadingPath] = useState('')
  const folderTreeCacheRef = useRef<Record<string, FolderCompareItem[]>>({})
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

  const jsonResult = jsonRichResult?.result ?? null
  const jsonDiffRows = jsonRichResult?.diffs ?? []
  const jsonDiffTextRows = useMemo(
    () => (jsonRichResult?.diffText ? parseUnifiedDiff(jsonRichResult.diffText) : null),
    [jsonRichResult?.diffText],
  )
  const jsonDiffTextItems = useMemo(
    () =>
      jsonDiffTextRows ? buildRichDiffItems(jsonDiffTextRows, jsonOldText, jsonNewText) : null,
    [jsonDiffTextRows, jsonOldText, jsonNewText],
  )
  const jsonDiffGroups = useMemo(() => buildJSONDiffGroups(jsonDiffRows), [jsonDiffRows])
  const canRenderJSONRich = !!jsonRichResult && !jsonRichResult.result.error
  const canRenderJSONDiff = !!jsonRichResult && !jsonResult?.error && !!jsonDiffTextRows
  const normalizedJSONSearchQuery = useMemo(
    () => normalizeSearchQuery(jsonSearchQuery),
    [jsonSearchQuery],
  )
  const jsonSearchMatches = useMemo(() => {
    if (!normalizedJSONSearchQuery) {
      return []
    }

    return jsonDiffRows
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        summarizeJSONSearchText(item).toLowerCase().includes(normalizedJSONSearchQuery),
      )
      .map(({ index }) => index)
  }, [jsonDiffRows, normalizedJSONSearchQuery])
  const jsonDiffSearchMatches = useMemo(
    () =>
      jsonDiffTextItems
        ? buildTextSearchMatches(jsonDiffTextItems, normalizedJSONSearchQuery)
        : [],
    [jsonDiffTextItems, normalizedJSONSearchQuery],
  )
  const jsonDiffSearchMatchIds = useMemo(
    () => new Set(jsonDiffSearchMatches.map((match) => match.id)),
    [jsonDiffSearchMatches],
  )
  const activeJSONDiffSearchMatch = jsonDiffSearchMatches[jsonActiveSearchIndex] ?? null
  const jsonSearchMatchIndexSet = useMemo(
    () => new Set(jsonSearchMatches),
    [jsonSearchMatches],
  )
  const jsonMatchGroupKeys = useMemo(
    () => buildJSONMatchGroupKeys(jsonDiffRows, jsonSearchMatches),
    [jsonDiffRows, jsonSearchMatches],
  )
  const effectiveJSONExpandedGroups = useMemo(() => {
    const keys = new Set<string>(jsonExpandedGroups)
    for (const key of jsonMatchGroupKeys) {
      keys.add(key)
    }
    return keys
  }, [jsonExpandedGroups, jsonMatchGroupKeys])

  const jsonPatchBlockedByFilters =
    ignoreOrder || jsonCommon.onlyBreaking || effectiveJSONIgnorePaths.length > 0
  const jsonOldParseError = useMemo(() => getJSONParseError(jsonOldText), [jsonOldText])
  const jsonNewParseError = useMemo(() => getJSONParseError(jsonNewText), [jsonNewText])
  const jsonInputInvalid = !!jsonOldParseError || !!jsonNewParseError
  const jsonInputEmpty = !jsonOldText.trim() || !jsonNewText.trim()
  const jsonEditorBusy = jsonClipboardBusyTarget !== null || jsonFileBusyTarget !== null
  const specResult = specRichResult?.result ?? null
  const specDiffRows = specRichResult?.diffs ?? []
  const specDiffTextRows = useMemo(
    () => (specRichResult?.diffText ? parseUnifiedDiff(specRichResult.diffText) : null),
    [specRichResult?.diffText],
  )
  const specDiffTextItems = useMemo(
    () =>
      specDiffTextRows ? buildRichDiffItems(specDiffTextRows, specOldText, specNewText) : null,
    [specDiffTextRows, specOldText, specNewText],
  )
  const canRenderSpecDiff = !!specRichResult && !specResult?.error && !!specDiffTextRows
  const normalizedSpecSearchQuery = useMemo(
    () => normalizeSearchQuery(specSearchQuery),
    [specSearchQuery],
  )
  const specSearchMatches = useMemo(() => {
    if (!normalizedSpecSearchQuery) {
      return []
    }

    return specDiffRows
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        summarizeSpecSearchText(item).toLowerCase().includes(normalizedSpecSearchQuery),
      )
      .map(({ index }) => index)
  }, [specDiffRows, normalizedSpecSearchQuery])
  const specDiffSearchMatches = useMemo(
    () =>
      specDiffTextItems
        ? buildTextSearchMatches(specDiffTextItems, normalizedSpecSearchQuery)
        : [],
    [specDiffTextItems, normalizedSpecSearchQuery],
  )
  const specDiffSearchMatchIds = useMemo(
    () => new Set(specDiffSearchMatches.map((match) => match.id)),
    [specDiffSearchMatches],
  )
  const activeSpecDiffSearchMatch = specDiffSearchMatches[specActiveSearchIndex] ?? null
  const specSearchMatchIndexSet = useMemo(
    () => new Set(specSearchMatches),
    [specSearchMatches],
  )
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
  const folderItems = folderResult?.items ?? []
  const filteredFolderItems = useMemo(() => {
    return filterFolderItemsByQuickFilter(folderItems, folderQuickFilter)
  }, [folderItems, folderQuickFilter])
  const sortedFolderItems = useMemo(() => {
    const items = [...filteredFolderItems]
    const directionMultiplier = folderSortDirection === 'asc' ? 1 : -1

    items.sort((left, right) => {
      if (folderSortKey === 'name') {
        if (left.isDir !== right.isDir) {
          return left.isDir ? -1 : 1
        }
        const comparedName = left.name.localeCompare(right.name, undefined, {
          sensitivity: 'base',
        })
        if (comparedName !== 0) {
          return comparedName * directionMultiplier
        }
        return left.relativePath.localeCompare(right.relativePath, undefined, {
          sensitivity: 'base',
        })
      }

      if (folderSortKey === 'status') {
        const rankDiff = folderStatusSortRank(left.status) - folderStatusSortRank(right.status)
        if (rankDiff !== 0) {
          return rankDiff * directionMultiplier
        }
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      }

      if (folderSortKey === 'left') {
        const compared = formatFolderSide(left.leftExists, left.leftKind, left.leftSize).localeCompare(
          formatFolderSide(right.leftExists, right.leftKind, right.leftSize),
          undefined,
          { sensitivity: 'base' },
        )
        if (compared !== 0) {
          return compared * directionMultiplier
        }
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      }

      const compared = formatFolderSide(left.rightExists, left.rightKind, left.rightSize).localeCompare(
        formatFolderSide(right.rightExists, right.rightKind, right.rightSize),
        undefined,
        { sensitivity: 'base' },
      )
      if (compared !== 0) {
        return compared * directionMultiplier
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    })

    return items
  }, [filteredFolderItems, folderSortDirection, folderSortKey])
  const selectedFolderItem = useMemo(
    () => sortedFolderItems.find((item) => item.relativePath === selectedFolderItemPath) ?? null,
    [sortedFolderItems, selectedFolderItemPath],
  )
  const filteredFolderTreeRoots = useMemo(
    () => filterFolderTreeNodesByQuickFilter(folderTreeRoots, folderQuickFilter),
    [folderTreeRoots, folderQuickFilter],
  )
  const flattenedFolderTreeRows = useMemo(
    () => flattenFolderTreeRows(filteredFolderTreeRoots),
    [filteredFolderTreeRoots],
  )
  const selectedFolderTreeItem = useMemo(
    () =>
      flattenedFolderTreeRows.find((row) => row.node.path === selectedFolderItemPath)?.node.item ??
      null,
    [flattenedFolderTreeRows, selectedFolderItemPath],
  )
  const selectedFolderItemForDetail =
    folderViewMode === 'tree' ? selectedFolderTreeItem : selectedFolderItem
  const folderQuickFilterCounts = useMemo(
    () => ({
      all: folderResult?.currentSummary.total ?? 0,
      changed: folderResult?.currentSummary.changed ?? 0,
      'left-only': folderResult?.currentSummary.leftOnly ?? 0,
      'right-only': folderResult?.currentSummary.rightOnly ?? 0,
      'type-mismatch': folderResult?.currentSummary.typeMismatch ?? 0,
      error: folderResult?.currentSummary.error ?? 0,
      same: folderResult?.currentSummary.same ?? 0,
    }),
    [folderResult],
  )
  const folderBreadcrumbs = useMemo(
    () => buildFolderBreadcrumbs(folderResult?.currentPath ?? folderCurrentPath),
    [folderResult?.currentPath, folderCurrentPath],
  )

  useEffect(() => {
    if (sortedFolderItems.length === 0) {
      if (folderViewMode === 'list' && selectedFolderItemPath !== '') {
        setSelectedFolderItemPath('')
      }
      return
    }
    if (folderViewMode !== 'list') {
      return
    }
    const hasSelection = sortedFolderItems.some(
      (item) => item.relativePath === selectedFolderItemPath,
    )
    if (!hasSelection) {
      setSelectedFolderItemPath(sortedFolderItems[0].relativePath)
    }
  }, [folderViewMode, sortedFolderItems, selectedFolderItemPath])

  useEffect(() => {
    if (folderViewMode !== 'tree') {
      return
    }
    if (flattenedFolderTreeRows.length === 0) {
      if (selectedFolderItemPath !== '') {
        setSelectedFolderItemPath('')
      }
      return
    }
    const hasSelection = flattenedFolderTreeRows.some(
      (row) => row.node.path === selectedFolderItemPath,
    )
    if (!hasSelection) {
      setSelectedFolderItemPath(flattenedFolderTreeRows[0].node.path)
    }
  }, [folderViewMode, flattenedFolderTreeRows, selectedFolderItemPath])

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
    setFolderTreeRoots((prevRoots) => {
      const previousByPath = new Map(prevRoots.map((node) => [node.path, node]))
      return folderItemsToTreeNodes(folderItems).map((node) => {
        const previous = previousByPath.get(node.path)
        if (!previous) {
          return {
            ...node,
            expanded: folderExpandedPaths.includes(node.path),
          }
        }
        return {
          ...node,
          children: previous.children,
          loaded: previous.loaded,
          expanded: folderExpandedPaths.includes(node.path),
        }
      })
    })
    folderTreeCacheRef.current[''] = folderItems
  }, [folderItems, folderExpandedPaths])

  useEffect(() => {
    folderTreeCacheRef.current = {}
    setFolderTreeRoots([])
    setFolderExpandedPaths([])
  }, [folderLeftRoot, folderRightRoot, folderNameFilter])

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

  useEffect(() => {
    if (!jsonRichResult) {
      return
    }

    if (jsonResultView === 'semantic' && !canRenderJSONRich) {
      setJSONResultView(canRenderJSONDiff ? 'diff' : 'raw')
      return
    }

    if (jsonResultView === 'diff' && !canRenderJSONDiff) {
      setJSONResultView(canRenderJSONRich ? 'semantic' : 'raw')
    }
  }, [canRenderJSONDiff, canRenderJSONRich, jsonRichResult, jsonResultView])

  useEffect(() => {
    if (!specRichResult) {
      return
    }

    if (specResultView === 'semantic' && !!specResult?.error) {
      setSpecResultView(canRenderSpecDiff ? 'diff' : 'raw')
      return
    }

    if (specResultView === 'semantic' && !specRichResult) {
      setSpecResultView(canRenderSpecDiff ? 'diff' : 'raw')
      return
    }

    if (specResultView === 'diff' && !canRenderSpecDiff) {
      setSpecResultView(specRichResult && !specResult?.error ? 'semantic' : 'raw')
    }
  }, [canRenderSpecDiff, specRichResult, specResult?.error, specResultView])

  useEffect(() => {
    setJSONExpandedGroups(jsonDiffGroups.map((group) => group.key))
    setJSONExpandedValueKeys([])
  }, [jsonDiffGroups])

  useEffect(() => {
    setJSONActiveSearchIndex(0)
  }, [normalizedJSONSearchQuery, jsonRichResult?.result.output])

  useEffect(() => {
    setSpecActiveSearchIndex(0)
  }, [normalizedSpecSearchQuery, specRichResult?.result.output])

  useEffect(() => {
    const targetLength =
      jsonResultView === 'semantic' ? jsonSearchMatches.length : jsonDiffSearchMatches.length
    if (targetLength === 0) {
      if (jsonActiveSearchIndex !== 0) {
        setJSONActiveSearchIndex(0)
      }
      return
    }

    if (jsonActiveSearchIndex >= targetLength) {
      setJSONActiveSearchIndex(0)
    }
  }, [jsonSearchMatches.length, jsonDiffSearchMatches.length, jsonActiveSearchIndex, jsonResultView])

  useEffect(() => {
    const targetLength =
      specResultView === 'semantic' ? specSearchMatches.length : specDiffSearchMatches.length
    if (targetLength === 0) {
      if (specActiveSearchIndex !== 0) {
        setSpecActiveSearchIndex(0)
      }
      return
    }

    if (specActiveSearchIndex >= targetLength) {
      setSpecActiveSearchIndex(0)
    }
  }, [specSearchMatches.length, specDiffSearchMatches.length, specActiveSearchIndex, specResultView])

  useEffect(() => {
    if (jsonResultView !== 'diff' || !canRenderJSONDiff || !activeJSONDiffSearchMatch) {
      return
    }
    const node = jsonDiffSearchRowRefs.current[activeJSONDiffSearchMatch.id]
    if (node) {
      node.scrollIntoView({ block: 'center' })
    }
  }, [activeJSONDiffSearchMatch?.id, canRenderJSONDiff, jsonResultView, textDiffLayout])

  useEffect(() => {
    if (specResultView !== 'diff' || !canRenderSpecDiff || !activeSpecDiffSearchMatch) {
      return
    }
    const node = specDiffSearchRowRefs.current[activeSpecDiffSearchMatch.id]
    if (node) {
      node.scrollIntoView({ block: 'center' })
    }
  }, [activeSpecDiffSearchMatch?.id, canRenderSpecDiff, specResultView, textDiffLayout])

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

  const loadFolderChildren = async (relativePath: string): Promise<FolderCompareItem[]> => {
    const cached = folderTreeCacheRef.current[relativePath]
    if (cached) {
      return cached
    }

    const fn = api.compareFolders
    if (!fn) {
      throw new Error('Wails bridge not available (CompareFolders)')
    }

    const res: CompareFoldersResponse = await fn({
      leftRoot: folderLeftRoot,
      rightRoot: folderRightRoot,
      currentPath: relativePath,
      recursive: true,
      showSame: true,
      nameFilter: folderNameFilter,
    } satisfies CompareFoldersRequest)

    if (res.error) {
      throw new Error(res.error)
    }

    folderTreeCacheRef.current[relativePath] = res.items
    return res.items
  }

  const updateTreeNodes = (
    nodes: FolderTreeNode[],
    path: string,
    updater: (node: FolderTreeNode) => FolderTreeNode,
  ): FolderTreeNode[] =>
    nodes.map((node) => {
      if (node.path === path) {
        return updater(node)
      }
      if (!node.children || node.children.length === 0) {
        return node
      }
      return {
        ...node,
        children: updateTreeNodes(node.children, path, updater),
      }
    })

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
        setJSONSearchQuery('')
        setJSONActiveSearchIndex(0)
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
        setSpecSearchQuery('')
        setSpecActiveSearchIndex(0)
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
    setFolderQuickFilter('all')
    setSelectedFolderItemPath('')
    setFolderCurrentPath(nextPath)
  }

  const expandFolderTreeNode = async (path: string) => {
    if (!folderLeftRoot || !folderRightRoot) {
      return
    }

    setFolderTreeLoadingPath(path)

    try {
      const items = await loadFolderChildren(path)
      const childNodes = folderItemsToTreeNodes(items)

      setFolderTreeRoots((prev) =>
        updateTreeNodes(prev, path, (node) => ({
          ...node,
          expanded: true,
          loaded: true,
          children: childNodes,
        })),
      )
      setFolderExpandedPaths((prev) => (prev.includes(path) ? prev : [...prev, path]))
    } catch (error) {
      const message = `Failed to load directory children: ${formatUnknownError(error)}`
      setFolderStatus(message)
      notifications.show({
        title: 'Failed to load directory',
        message,
        color: 'red',
      })
    } finally {
      setFolderTreeLoadingPath('')
    }
  }

  const collapseFolderTreeNode = (path: string) => {
    setFolderTreeRoots((prev) =>
      updateTreeNodes(prev, path, (node) => ({
        ...node,
        expanded: false,
      })),
    )
    setFolderExpandedPaths((prev) => prev.filter((entry) => entry !== path))
  }

  const toggleFolderTreeNode = async (node: FolderTreeNode) => {
    if (!node.isDir) {
      return
    }
    if (node.expanded) {
      collapseFolderTreeNode(node.path)
      return
    }
    await expandFolderTreeNode(node.path)
  }

  const applyFolderSort = (key: FolderSortKey) => {
    const next = toggleFolderSort(key, folderSortKey, folderSortDirection)
    setFolderSortKey(next.key)
    setFolderSortDirection(next.dir)
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
    setJSONSearchQuery('')
    setJSONActiveSearchIndex(0)
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
    setSpecSearchQuery('')
    setSpecActiveSearchIndex(0)
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
    setJSONSearchQuery('')
    setJSONActiveSearchIndex(0)
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
    setSpecSearchQuery('')
    setSpecActiveSearchIndex(0)
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

  const buildModeRowId = (_modeKey: 'json' | 'spec', itemIndex: number) =>
    buildTextSearchRowIDForItem(itemIndex)

  const buildModeOmittedRowId = (
    modeKey: 'json' | 'spec',
    sectionId: string,
    itemIndex: number,
  ) => buildTextSearchRowIDForOmitted(sectionId, itemIndex)

  const registerModeSearchRowRef =
    (rowRefs: MutableRefObject<Record<string, HTMLDivElement | null>>, matchId: string) =>
    (node: HTMLDivElement | null) => {
      if (node) {
        rowRefs.current[matchId] = node
        return
      }
      delete rowRefs.current[matchId]
    }

  const renderModeUnifiedDiffRows = (
    items: RichDiffItem[],
    modeKey: 'json' | 'spec',
    searchMatchIds: Set<string>,
    activeMatchId: string | null,
    rowRefs: MutableRefObject<Record<string, HTMLDivElement | null>>,
  ) => {
    const showHunkHeaders = shouldShowTextHunkHeaders(items)

    return (
      <div className="text-diff-grid">
        {items.map((item, idx) => {
          if (item.kind === 'omitted') {
            const expanded = true
            return (
              <div key={`${modeKey}-${item.sectionId}`} className="text-omitted-block">
                <div className={`text-omitted-banner ${expanded ? 'expanded' : ''}`}>
                  <span className="muted">{item.lines.length} unchanged lines</span>
                </div>
                {item.lines.map((line, lineIndex) => {
                  const row = buildExpandedContextRow(
                    line,
                    item.startOldLine + lineIndex,
                    item.startNewLine + lineIndex,
                  )
                  const matchId = buildModeOmittedRowId(modeKey, item.sectionId, lineIndex)
                  const matched = searchMatchIds.has(matchId)
                  const rowClass = matched
                    ? activeMatchId === matchId
                      ? 'active-search-hit'
                      : 'search-hit'
                    : ''
                  return (
                    <div
                      key={`${modeKey}-${item.sectionId}-${lineIndex}`}
                      ref={
                        matched
                          ? registerModeSearchRowRef(rowRefs, matchId)
                          : undefined
                      }
                      className={['text-diff-row', row.kind, rowClass].filter(Boolean).join(' ')}
                    >
                      <div className="text-diff-line">{row.oldLine ?? ''}</div>
                      <div className="text-diff-line">{row.newLine ?? ''}</div>
                      <pre className="text-diff-content">{row.content}</pre>
                    </div>
                  )
                })}
              </div>
            )
          }

          const row = item.row
          if (shouldHideTextRichMetaRow(row)) {
            return null
          }
          if (row.kind === 'hunk' && !showHunkHeaders) {
            return null
          }
          const matchId = buildModeRowId(modeKey, idx)
          const matched = searchMatchIds.has(matchId)
          const rowClass = matched
            ? activeMatchId === matchId
              ? 'active-search-hit'
              : 'search-hit'
            : ''
          return (
            <div
              key={`${modeKey}-${idx}-${row.kind}`}
              ref={matched ? registerModeSearchRowRef(rowRefs, matchId) : undefined}
              className={['text-diff-row', row.kind, rowClass].filter(Boolean).join(' ')}
            >
              <div className="text-diff-line">{row.oldLine ?? ''}</div>
              <div className="text-diff-line">{row.newLine ?? ''}</div>
              <pre className="text-diff-content">
                {renderInlineDiffContent(row, `${modeKey}-diff-${idx}`)}
              </pre>
            </div>
          )
        })}
      </div>
    )
  }

  const renderModeSplitDiffRows = (
    items: RichDiffItem[],
    modeKey: 'json' | 'spec',
    searchMatchIds: Set<string>,
    activeMatchId: string | null,
    rowRefs: MutableRefObject<Record<string, HTMLDivElement | null>>,
  ) => {
    const showHunkHeaders = shouldShowTextHunkHeaders(items)
    const splitNodes: JSX.Element[] = []
    let index = 0

    while (index < items.length) {
      const item = items[index]

      if (item.kind === 'omitted') {
        splitNodes.push(
          <div key={`${modeKey}-split-omitted-${item.sectionId}`} className="split-omitted-block">
            <div className="split-diff-banner omitted">
              <div className="split-omitted-banner-inner">
                <span className="muted">{item.lines.length} unchanged lines</span>
              </div>
            </div>
            {item.lines.map((line, lineIndex) => {
              const row = buildExpandedContextRow(
                line,
                item.startOldLine + lineIndex,
                item.startNewLine + lineIndex,
              )
              const matchId = buildModeOmittedRowId(modeKey, item.sectionId, lineIndex)
              const matched = searchMatchIds.has(matchId)
              const rowClass = matched
                ? activeMatchId === matchId
                  ? 'active-search-hit'
                  : 'search-hit'
                : ''
              return (
                <div key={`${modeKey}-split-omitted-row-${item.sectionId}-${lineIndex}`} className="split-diff-row">
                  {renderSplitDiffCell(
                    row,
                    'left',
                    `${modeKey}-split-omitted-left-${item.sectionId}-${lineIndex}`,
                    rowClass,
                    matched ? registerModeSearchRowRef(rowRefs, matchId) : undefined,
                  )}
                  {renderSplitDiffCell(
                    row,
                    'right',
                    `${modeKey}-split-omitted-right-${item.sectionId}-${lineIndex}`,
                    rowClass,
                  )}
                </div>
              )
            })}
          </div>,
        )
        index++
        continue
      }

      const row = item.row
      if (row.kind === 'meta' || row.kind === 'hunk') {
        if (shouldHideTextRichMetaRow(row)) {
          index++
          continue
        }
        if (row.kind === 'hunk' && !showHunkHeaders) {
          index++
          continue
        }
        splitNodes.push(
          <div key={`${modeKey}-split-banner-${index}`} className={`split-diff-banner ${row.kind}`}>
            <pre className="split-diff-banner-content">{row.content}</pre>
          </div>,
        )
        index++
        continue
      }

      if (row.kind === 'context') {
        const matchId = buildModeRowId(modeKey, index)
        const matched = searchMatchIds.has(matchId)
        const rowClass = matched
          ? activeMatchId === matchId
            ? 'active-search-hit'
            : 'search-hit'
          : ''
        splitNodes.push(
          <div key={`${modeKey}-split-row-${index}`} className="split-diff-row">
            {renderSplitDiffCell(
              row,
              'left',
              `${modeKey}-split-left-${index}`,
              rowClass,
              matched ? registerModeSearchRowRef(rowRefs, matchId) : undefined,
            )}
            {renderSplitDiffCell(row, 'right', `${modeKey}-split-right-${index}`, rowClass)}
          </div>,
        )
        index++
        continue
      }

      const removed: Array<{ row: UnifiedDiffRow; matchId: string }> = []
      const added: Array<{ row: UnifiedDiffRow; matchId: string }> = []
      let end = index

      while (end < items.length) {
        const candidate = items[end]
        if (candidate.kind !== 'row') {
          break
        }
        if (candidate.row.kind !== 'remove' && candidate.row.kind !== 'add') {
          break
        }
        const matchId = buildModeRowId(modeKey, end)
        if (candidate.row.kind === 'remove') {
          removed.push({ row: candidate.row, matchId })
        } else {
          added.push({ row: candidate.row, matchId })
        }
        end++
      }

      const pairCount = Math.max(removed.length, added.length)
      for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
        const left = removed[pairIndex] ?? null
        const right = added[pairIndex] ?? null
        const leftMatched = left ? searchMatchIds.has(left.matchId) : false
        const rightMatched = right ? searchMatchIds.has(right.matchId) : false
        splitNodes.push(
          <div key={`${modeKey}-split-pair-${index}-${pairIndex}`} className="split-diff-row">
            {renderSplitDiffCell(
              left?.row ?? null,
              'left',
              `${modeKey}-split-pair-left-${index}-${pairIndex}`,
              leftMatched
                ? activeMatchId === left?.matchId
                  ? 'active-search-hit'
                  : 'search-hit'
                : '',
              left && leftMatched
                ? registerModeSearchRowRef(rowRefs, left.matchId)
                : undefined,
            )}
            {renderSplitDiffCell(
              right?.row ?? null,
              'right',
              `${modeKey}-split-pair-right-${index}-${pairIndex}`,
              rightMatched
                ? activeMatchId === right?.matchId
                  ? 'active-search-hit'
                  : 'search-hit'
                : '',
              right && rightMatched
                ? registerModeSearchRowRef(rowRefs, right.matchId)
                : undefined,
            )}
          </div>,
        )
      }

      index = end
    }

    return (
      <div className="split-diff-grid">
        <div className="split-diff-header">
          <div className="split-diff-header-cell">Old</div>
          <div className="split-diff-header-cell">New</div>
        </div>
        {splitNodes}
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
      isTextSearchMatchId={isTextSearchMatchId}
      registerTextSearchRowRef={registerTextSearchRowRef}
      getTextSearchClassName={getTextSearchClassName}
      renderInlineDiffContent={renderInlineDiffContent}
      renderSplitDiffCell={renderSplitDiffCell}
    />
  )

  const moveJSONSearch = (direction: 1 | -1) => {
    const targetMatches =
      jsonResultView === 'semantic' ? jsonSearchMatches : jsonDiffSearchMatches
    const canSearch =
      jsonResultView === 'semantic'
        ? canRenderJSONRich
        : jsonResultView === 'diff'
          ? canRenderJSONDiff
          : false
    if (!canSearch || targetMatches.length === 0) {
      return
    }

    setJSONActiveSearchIndex((prev) =>
      direction === 1
        ? (prev + 1) % targetMatches.length
        : (prev - 1 + targetMatches.length) % targetMatches.length,
    )
  }

  const toggleJSONGroup = (groupKey: string) => {
    setJSONExpandedGroups((prev) =>
      prev.includes(groupKey)
        ? prev.filter((key) => key !== groupKey)
        : [...prev, groupKey],
    )
  }

  const toggleJSONExpandedValue = (valueKey: string) => {
    setJSONExpandedValueKeys((prev) =>
      prev.includes(valueKey)
        ? prev.filter((key) => key !== valueKey)
        : [...prev, valueKey],
    )
  }

  const renderHighlightedText = (value: string, normalizedQuery: string) => {
    if (!normalizedQuery) {
      return value
    }

    const lower = value.toLowerCase()
    const parts: Array<{ text: string; hit: boolean }> = []
    let cursor = 0

    while (cursor < value.length) {
      const found = lower.indexOf(normalizedQuery, cursor)
      if (found === -1) {
        parts.push({ text: value.slice(cursor), hit: false })
        break
      }

      if (found > cursor) {
        parts.push({ text: value.slice(cursor, found), hit: false })
      }
      parts.push({ text: value.slice(found, found + normalizedQuery.length), hit: true })
      cursor = found + normalizedQuery.length
    }

    return parts.map((part, index) =>
      part.hit ? (
        <span key={`hit-${index}`} className="json-search-hit">
          {part.text}
        </span>
      ) : (
        <span key={`plain-${index}`}>{part.text}</span>
      ),
    )
  }

  const renderJSONValueCell = (
    value: unknown,
    valueKey: string,
    normalizedQuery: string,
  ) => {
    if (value === undefined) {
      return <span className="muted">—</span>
    }

    if (value === null) {
      return <CompareValueBlock inline>null</CompareValueBlock>
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value)
      return (
        <CompareValueBlock inline>{renderHighlightedText(text, normalizedQuery)}</CompareValueBlock>
      )
    }

    const rendered = stringifyJSONValue(value)
    const lines = rendered.split('\n')
    const canExpand = lines.length > 5
    const expanded = jsonExpandedValueKeys.includes(valueKey)
    const shown = canExpand && !expanded ? [...lines.slice(0, 5), '...'] : lines

    return (
      <div className="json-value-wrap">
        <CompareValueBlock expanded={expanded}>{shown.join('\n')}</CompareValueBlock>
        {canExpand ? (
          <button
            type="button"
            className="button-secondary button-compact json-value-toggle"
            onClick={() => toggleJSONExpandedValue(valueKey)}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        ) : null}
      </div>
    )
  }

  const renderJSONTypeLabel = (type: JSONRichDiffItem['type']) => {
    if (type === 'type_changed') {
      return 'type changed'
    }
    return type
  }

  const renderJSONResultPanel = () => {
    const raw = jsonResult ? renderResult(jsonResult) : ''
    const showDiff = jsonResultView === 'diff' && canRenderJSONDiff && !!jsonDiffTextItems
    const showSemantic = jsonResultView === 'semantic' && canRenderJSONRich
    const canSearch =
      jsonResultView === 'semantic'
        ? showSemantic
        : jsonResultView === 'diff'
          ? showDiff
          : false
    const activeJSONMatch = jsonSearchMatches[jsonActiveSearchIndex] ?? -1
    const activeJSONDiffMatch = jsonDiffSearchMatches[jsonActiveSearchIndex] ?? null
    const hasJSONResult = !!jsonResult
    const summary = jsonRichResult?.summary
    const jsonDiffRowIndexMap = new Map<JSONRichDiffItem, number>()
    jsonDiffRows.forEach((diff, index) => {
      jsonDiffRowIndexMap.set(diff, index)
    })
    const jsonSummaryItems = buildJSONSummaryBadgeItems({
      hasResult: hasJSONResult,
      hasError: !!jsonResult?.error,
      diffFound: !!jsonResult?.diffFound,
      added: summary?.added ?? 0,
      removed: summary?.removed ?? 0,
      changed: summary?.changed ?? 0,
      typeChanged: summary?.typeChanged ?? 0,
      breaking: summary?.breaking ?? 0,
    })
    const jsonSearchStatus = normalizedJSONSearchQuery
      ? (jsonResultView === 'semantic' ? jsonSearchMatches.length : jsonDiffSearchMatches.length) > 0
        ? `${jsonActiveSearchIndex + 1} / ${
            jsonResultView === 'semantic'
              ? jsonSearchMatches.length
              : jsonDiffSearchMatches.length
          }`
        : '0 matches'
      : null

    return (
      <CompareResultShell
        hasResult={hasJSONResult}
        toolbar={
          <CompareResultToolbar
            primary={
              <CompareSearchControls
                value={jsonSearchQuery}
                placeholder={
                  jsonResultView === 'semantic' ? 'Search paths or values' : 'Search diff'
                }
                statusText={jsonSearchStatus}
                disabled={!canSearch}
                onChange={setJSONSearchQuery}
                onPrev={() => moveJSONSearch(-1)}
                onNext={() => moveJSONSearch(1)}
                prevDisabled={
                  !canSearch ||
                  (jsonResultView === 'semantic'
                    ? jsonSearchMatches.length === 0
                    : jsonDiffSearchMatches.length === 0)
                }
                nextDisabled={
                  !canSearch ||
                  (jsonResultView === 'semantic'
                    ? jsonSearchMatches.length === 0
                    : jsonDiffSearchMatches.length === 0)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    moveJSONSearch(e.shiftKey ? -1 : 1)
                    return
                  }

                  if (e.key === 'Escape') {
                    setJSONSearchQuery('')
                  }
                }}
              />
            }
            summary={<CompareStatusBadges items={jsonSummaryItems} />}
            secondary={
              <>
                <Tooltip label="Copy raw output">
                  <ActionIcon
                    variant="default"
                    size={28}
                    aria-label="Copy raw output"
                    className="text-result-action"
                    onClick={() => void copyJSONResultRawOutput()}
                    disabled={jsonCopyBusy || !raw}
                    loading={jsonCopyBusy}
                  >
                    <IconCopy size={15} />
                  </ActionIcon>
                </Tooltip>
                <ViewSettingsMenu
                  tooltip="View settings"
                  sections={[
                    {
                      title: 'Display',
                      items: [
                        {
                          key: 'json-display-diff',
                          label: 'Diff',
                          active: jsonResultView === 'diff',
                          disabled: !canRenderJSONDiff,
                          onSelect: () => setJSONResultView('diff'),
                        },
                        {
                          key: 'json-display-semantic',
                          label: 'Semantic',
                          active: jsonResultView === 'semantic',
                          disabled: !canRenderJSONRich,
                          onSelect: () => setJSONResultView('semantic'),
                        },
                        {
                          key: 'json-display-raw',
                          label: 'Raw',
                          active: jsonResultView === 'raw',
                          onSelect: () => setJSONResultView('raw'),
                        },
                      ],
                    },
                    {
                      title: 'Layout',
                      items: [
                        {
                          key: 'json-layout-split',
                          label: 'Split',
                          active: textDiffLayout === 'split',
                          disabled: jsonResultView !== 'diff' || !canRenderJSONDiff,
                          onSelect: () => setTextDiffLayout('split'),
                        },
                        {
                          key: 'json-layout-unified',
                          label: 'Unified',
                          active: textDiffLayout === 'unified',
                          disabled: jsonResultView !== 'diff' || !canRenderJSONDiff,
                          onSelect: () => setTextDiffLayout('unified'),
                        },
                      ],
                    },
                  ]}
                />
              </>
            }
          />
        }
      >
        {showDiff && jsonDiffTextItems ? (
          textDiffLayout === 'split' ? (
            renderModeSplitDiffRows(
              jsonDiffTextItems,
              'json',
              jsonDiffSearchMatchIds,
              activeJSONDiffMatch?.id ?? null,
              jsonDiffSearchRowRefs,
            )
          ) : (
            renderModeUnifiedDiffRows(
              jsonDiffTextItems,
              'json',
              jsonDiffSearchMatchIds,
              activeJSONDiffMatch?.id ?? null,
              jsonDiffSearchRowRefs,
            )
          )
        ) : showSemantic ? (
          <div className="json-diff-table-wrap">
            {jsonDiffRows.length === 0 ? (
              <CompareStatusState kind="success-empty" />
            ) : (
              <table className="json-diff-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Path</th>
                    <th>Old</th>
                    <th>New</th>
                  </tr>
                </thead>
                <tbody>
                  {jsonDiffGroups.map((group) => {
                    const expanded = effectiveJSONExpandedGroups.has(group.key)
                    return (
                      <Fragment key={`group-${group.key}`}>
                        <tr key={`group-${group.key}`} className="json-group-row">
                          <td colSpan={4}>
                            <CompareSectionHeader
                              title={group.key}
                              countLabel={`${group.items.length} changes`}
                              collapsed={!expanded}
                              onToggle={() => toggleJSONGroup(group.key)}
                              badges={
                                <>
                                  {group.summary.added > 0 ? (
                                    <span className="json-group-stat added">+{group.summary.added}</span>
                                  ) : null}
                                  {group.summary.removed > 0 ? (
                                    <span className="json-group-stat removed">-{group.summary.removed}</span>
                                  ) : null}
                                  {group.summary.changed > 0 ? (
                                    <span className="json-group-stat changed">~{group.summary.changed}</span>
                                  ) : null}
                                  {group.summary.typeChanged > 0 ? (
                                    <span className="json-group-stat type-changed">
                                      type {group.summary.typeChanged}
                                    </span>
                                  ) : null}
                                  {group.summary.breaking > 0 ? (
                                    <span className="json-breaking-badge">
                                      breaking {group.summary.breaking}
                                    </span>
                                  ) : null}
                                </>
                              }
                            />
                          </td>
                        </tr>

                        {expanded
                          ? group.items.map((diff) => {
                              const index = jsonDiffRowIndexMap.get(diff) ?? -1
                              const searchHit = jsonSearchMatchIndexSet.has(index)
                              const activeHit = activeJSONMatch === index
                              return (
                                <tr
                                  key={`${diff.type}-${diff.path}-${index}`}
                                  className={[
                                    'json-diff-row',
                                    diff.type,
                                    searchHit ? 'search-hit' : '',
                                    activeHit ? 'active-search-hit' : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  <td className="json-diff-cell json-diff-cell-type">
                                    <div className="json-cell-inline json-type-cell">
                                      <span className={`json-type-badge ${diff.type}`}>
                                        {renderJSONTypeLabel(diff.type)}
                                      </span>
                                      {diff.breaking ? (
                                        <span className="json-breaking-badge">breaking</span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="json-diff-cell json-diff-cell-path">
                                    <div className="json-cell-inline json-path-cell">
                                      {renderHighlightedText(diff.path, normalizedJSONSearchQuery)}
                                    </div>
                                  </td>
                                  <td>
                                    {renderJSONValueCell(
                                      diff.oldValue,
                                      `${index}:${diff.path}:old`,
                                      normalizedJSONSearchQuery,
                                    )}
                                  </td>
                                  <td>
                                    {renderJSONValueCell(
                                      diff.newValue,
                                      `${index}:${diff.path}:new`,
                                      normalizedJSONSearchQuery,
                                    )}
                                  </td>
                                </tr>
                              )
                            })
                          : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <pre className="result-output">{raw}</pre>
        )}
      </CompareResultShell>
    )
  }

  const renderSpecResultPanel = () => {
    const raw = specResult ? renderResult(specResult) : ''
    const showDiff = specResultView === 'diff' && canRenderSpecDiff && !!specDiffTextItems
    const showSemantic = specResultView === 'semantic' && !!specRichResult && !specResult?.error
    const canSearch =
      specResultView === 'semantic'
        ? showSemantic
        : specResultView === 'diff'
          ? showDiff
          : false
    const activeSpecMatch = specSearchMatches[specActiveSearchIndex] ?? -1
    const activeSpecDiffMatch = specDiffSearchMatches[specActiveSearchIndex] ?? null
    const summary = specRichResult?.summary
    const specSummaryItems = buildSpecSummaryBadgeItems({
      hasResult: !!specResult,
      hasError: !!specResult?.error,
      diffFound: !!specResult?.diffFound,
      added: summary?.added ?? 0,
      removed: summary?.removed ?? 0,
      changed: summary?.changed ?? 0,
      typeChanged: summary?.typeChanged ?? 0,
      breaking: summary?.breaking ?? 0,
    })
    const specSearchStatus = normalizedSpecSearchQuery
      ? (specResultView === 'semantic' ? specSearchMatches.length : specDiffSearchMatches.length) > 0
        ? `${specActiveSearchIndex + 1} / ${
            specResultView === 'semantic'
              ? specSearchMatches.length
              : specDiffSearchMatches.length
          }`
        : '0 matches'
      : null

    const moveSpecSearch = (direction: 1 | -1) => {
      const targetMatches =
        specResultView === 'semantic' ? specSearchMatches : specDiffSearchMatches
      if (!canSearch || targetMatches.length === 0) {
        return
      }
      setSpecActiveSearchIndex((prev) =>
        direction === 1
          ? (prev + 1) % targetMatches.length
          : (prev - 1 + targetMatches.length) % targetMatches.length,
      )
    }

    return (
      <CompareResultShell
        hasResult={!!specResult}
        toolbar={
          <CompareResultToolbar
            primary={
              <CompareSearchControls
                value={specSearchQuery}
                placeholder={
                  specResultView === 'semantic' ? 'Search paths or labels' : 'Search diff'
                }
                statusText={specSearchStatus}
                disabled={!canSearch}
                onChange={setSpecSearchQuery}
                onPrev={() => moveSpecSearch(-1)}
                onNext={() => moveSpecSearch(1)}
                prevDisabled={
                  !canSearch ||
                  (specResultView === 'semantic'
                    ? specSearchMatches.length === 0
                    : specDiffSearchMatches.length === 0)
                }
                nextDisabled={
                  !canSearch ||
                  (specResultView === 'semantic'
                    ? specSearchMatches.length === 0
                    : specDiffSearchMatches.length === 0)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    moveSpecSearch(e.shiftKey ? -1 : 1)
                    return
                  }

                  if (e.key === 'Escape') {
                    setSpecSearchQuery('')
                  }
                }}
              />
            }
            summary={<CompareStatusBadges items={specSummaryItems} />}
            secondary={
              <>
                <Tooltip label="Copy raw output">
                  <ActionIcon
                    variant="default"
                    size={28}
                    aria-label="Copy raw output"
                    className="text-result-action"
                    onClick={() => void copySpecResultRawOutput()}
                    disabled={specCopyBusy || !raw}
                    loading={specCopyBusy}
                  >
                    <IconCopy size={15} />
                  </ActionIcon>
                </Tooltip>
                <ViewSettingsMenu
                  tooltip="View settings"
                  sections={[
                    {
                      title: 'Display',
                      items: [
                        {
                          key: 'spec-display-diff',
                          label: 'Diff',
                          active: specResultView === 'diff',
                          disabled: !canRenderSpecDiff,
                          onSelect: () => setSpecResultView('diff'),
                        },
                        {
                          key: 'spec-display-semantic',
                          label: 'Semantic',
                          active: specResultView === 'semantic',
                          disabled: !specRichResult || !!specResult?.error,
                          onSelect: () => setSpecResultView('semantic'),
                        },
                        {
                          key: 'spec-display-raw',
                          label: 'Raw',
                          active: specResultView === 'raw',
                          onSelect: () => setSpecResultView('raw'),
                        },
                      ],
                    },
                    {
                      title: 'Layout',
                      items: [
                        {
                          key: 'spec-layout-split',
                          label: 'Split',
                          active: textDiffLayout === 'split',
                          disabled: specResultView !== 'diff' || !canRenderSpecDiff,
                          onSelect: () => setTextDiffLayout('split'),
                        },
                        {
                          key: 'spec-layout-unified',
                          label: 'Unified',
                          active: textDiffLayout === 'unified',
                          disabled: specResultView !== 'diff' || !canRenderSpecDiff,
                          onSelect: () => setTextDiffLayout('unified'),
                        },
                      ],
                    },
                  ]}
                />
              </>
            }
          />
        }
      >
        {showDiff && specDiffTextItems ? (
          textDiffLayout === 'split' ? (
            renderModeSplitDiffRows(
              specDiffTextItems,
              'spec',
              specDiffSearchMatchIds,
              activeSpecDiffMatch?.id ?? null,
              specDiffSearchRowRefs,
            )
          ) : (
            renderModeUnifiedDiffRows(
              specDiffTextItems,
              'spec',
              specDiffSearchMatchIds,
              activeSpecDiffMatch?.id ?? null,
              specDiffSearchRowRefs,
            )
          )
        ) : showSemantic && specRichResult ? (
          <SpecRichDiffViewer
            diffs={specRichResult.diffs}
            searchQuery={specSearchQuery}
            searchMatchIndexSet={specSearchMatchIndexSet}
            activeMatchIndex={activeSpecMatch}
          />
        ) : (
          <pre className="result-output">{raw}</pre>
        )}
      </CompareResultShell>
    )
  }

  const renderFolderResultPanel = () => {
    const res = folderResult
    const quickFilters: FolderQuickFilter[] = [
      'all',
      'changed',
      'left-only',
      'right-only',
      'type-mismatch',
      'error',
      'same',
    ]
    const detailActionReason = selectedFolderItemForDetail
      ? getFolderItemActionReason(selectedFolderItemForDetail)
      : null
    const currentPath = res?.currentPath ?? folderCurrentPath
    const visibleCount =
      folderViewMode === 'tree' ? flattenedFolderTreeRows.length : sortedFolderItems.length
    const canCompareFolders = !!folderLeftRoot && !!folderRightRoot
    const shouldShowFolderDetail =
      folderViewMode === 'list' && !!selectedFolderItemForDetail

    return (
      <SectionCard>
        <div
          className={`folder-result-shell ${folderViewMode === 'tree' ? 'is-tree-mode' : ''}`.trim()}
        >
          <div className="folder-result-header">
            <div className="folder-header-bar">
              <div className="folder-header-context">
                <span className="folder-title">Directory Compare</span>
                <div className="folder-current-path" aria-label="Current path">
                  {folderBreadcrumbs.map((crumb, index) => (
                    <Fragment key={crumb.path || 'root'}>
                      {crumb.path === currentPath ? (
                        <span className="folder-breadcrumb-current">{crumb.label}</span>
                      ) : (
                        <button
                          type="button"
                          className="folder-breadcrumb-link"
                          onClick={() => void navigateFolderPath(crumb.path)}
                          disabled={loading || !canCompareFolders}
                        >
                          {crumb.label}
                        </button>
                      )}
                      {index < folderBreadcrumbs.length - 1 ? (
                        <span className="folder-breadcrumb-sep">/</span>
                      ) : null}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
            <div className="folder-root-bar">
              <div
                className="folder-root-field"
                onClick={() => void browseFolderRoot('left')}
                role="button"
                tabIndex={loading ? -1 : 0}
                onKeyDown={(event) => {
                  if (loading) {
                    return
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void browseFolderRoot('left')
                  }
                }}
              >
                <span className="folder-root-label">Left</span>
                <input
                  className="folder-root-input"
                  readOnly
                  value={folderLeftRoot}
                  placeholder="Select left directory"
                  title={folderLeftRoot || 'Select left directory'}
                />
                <ActionIcon
                  variant="default"
                  size={24}
                  aria-label="Pick left directory"
                  onClick={(event) => {
                    event.stopPropagation()
                    void browseFolderRoot('left')
                  }}
                  disabled={loading}
                >
                  <IconFolderOpen size={14} />
                </ActionIcon>
              </div>
              <div
                className="folder-root-field"
                onClick={() => void browseFolderRoot('right')}
                role="button"
                tabIndex={loading ? -1 : 0}
                onKeyDown={(event) => {
                  if (loading) {
                    return
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void browseFolderRoot('right')
                  }
                }}
              >
                <span className="folder-root-label">Right</span>
                <input
                  className="folder-root-input"
                  readOnly
                  value={folderRightRoot}
                  placeholder="Select right directory"
                  title={folderRightRoot || 'Select right directory'}
                />
                <ActionIcon
                  variant="default"
                  size={24}
                  aria-label="Pick right directory"
                  onClick={(event) => {
                    event.stopPropagation()
                    void browseFolderRoot('right')
                  }}
                  disabled={loading}
                >
                  <IconFolderOpen size={14} />
                </ActionIcon>
              </div>
            </div>

            {folderStatus ? <div className="muted">{folderStatus}</div> : null}
          </div>

          <div className="folder-quick-filters">
            <div className="folder-result-toolbar-left">
              <div className="folder-compact-summary">
                <span>{res?.scannedSummary.total ?? 0} scanned</span>
                <span>{visibleCount} here</span>
              </div>
              <div
                className="folder-view-mode-toggle"
                role="tablist"
                aria-label="Directory view mode"
              >
                <button
                  type="button"
                  className={`button-secondary button-compact ${
                    folderViewMode === 'list' ? 'folder-quick-filter-active' : ''
                  }`}
                  onClick={() => setFolderViewMode('list')}
                  role="tab"
                  aria-selected={folderViewMode === 'list'}
                >
                  <IconList size={13} />
                  List
                </button>
                <button
                  type="button"
                  className={`button-secondary button-compact ${
                    folderViewMode === 'tree' ? 'folder-quick-filter-active' : ''
                  }`}
                  onClick={() => setFolderViewMode('tree')}
                  role="tab"
                  aria-selected={folderViewMode === 'tree'}
                >
                  <IconBinaryTree2 size={13} />
                  Tree
                </button>
              </div>
            </div>
            <div className="folder-result-toolbar-right">
              {quickFilters.map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  className={`button-secondary button-compact ${
                    folderQuickFilter === filterKey ? 'folder-quick-filter-active' : ''
                  }`}
                  onClick={() => setFolderQuickFilter(filterKey)}
                >
                  {folderQuickFilterLabel(filterKey)} ({folderQuickFilterCounts[filterKey]})
                </button>
              ))}
              <input
                className="folder-name-filter-input"
                value={folderNameFilter}
                onChange={(event) => setFolderNameFilter(event.target.value)}
                placeholder="name filter"
              />
            </div>
          </div>

          <div className="folder-list-tree-viewport">
            {res?.error ? (
              <pre className="result-output">{res.error}</pre>
            ) : res ? (
              folderViewMode === 'list' ? (
                <div
                  className="folder-table-wrap"
                  tabIndex={0}
                  onKeyDown={(event) => void handleFolderTableKeyDown(event)}
                  onFocus={() => {
                    if (!selectedFolderItemPath && sortedFolderItems.length > 0) {
                      setSelectedFolderItemPath(sortedFolderItems[0].relativePath)
                    }
                  }}
                >
                  <table className="folder-results-table">
                    <thead>
                      <tr>
                        <th className="folder-sortable-header" onClick={() => applyFolderSort('name')}>
                          Name
                          {folderSortKey === 'name' ? (
                            <span className="folder-sort-indicator">
                              {folderSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          ) : null}
                        </th>
                        <th className="folder-sortable-header" onClick={() => applyFolderSort('status')}>
                          Status
                          {folderSortKey === 'status' ? (
                            <span className="folder-sort-indicator">
                              {folderSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          ) : null}
                        </th>
                        <th className="folder-sortable-header" onClick={() => applyFolderSort('left')}>
                          Left
                          {folderSortKey === 'left' ? (
                            <span className="folder-sort-indicator">
                              {folderSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          ) : null}
                        </th>
                        <th className="folder-sortable-header" onClick={() => applyFolderSort('right')}>
                          Right
                          {folderSortKey === 'right' ? (
                            <span className="folder-sort-indicator">
                              {folderSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          ) : null}
                        </th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFolderItems.length === 0 ? (
                        <tr>
                          <td colSpan={5}>
                            <div className="muted">No entries to show.</div>
                          </td>
                        </tr>
                      ) : (
                        sortedFolderItems.map((item) => {
                          const openable = canOpenFolderItem(item)
                          const enterable = item.isDir && item.status !== 'type-mismatch'
                          const actionReason = getFolderItemActionReason(item)
                          const selected = item.relativePath === selectedFolderItemPath

                          return (
                            <tr
                              key={item.relativePath}
                              className={[
                                selected ? 'folder-row-selected' : '',
                                enterable || openable ? 'folder-row-clickable' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onClick={() => setSelectedFolderItemPath(item.relativePath)}
                              onDoubleClick={() => void handleFolderRowDoubleClick(item)}
                            >
                              <td>
                                <div
                                  className={`folder-item-name ${enterable ? 'is-dir' : ''}`}
                                  onClick={(event) => {
                                    if (!enterable) return
                                    event.stopPropagation()
                                    void navigateFolderPath(item.relativePath)
                                  }}
                                >
                                  {item.isDir ? <IconFolderOpen size={14} /> : <IconFile size={14} />}
                                  <span
                                    className="folder-entry-path"
                                    title={`${item.leftPath || '(missing)'}\n${item.rightPath || '(missing)'}`}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                                {item.relativePath !== item.name ? (
                                  <div className="folder-entry-sub muted">{item.relativePath}</div>
                                ) : null}
                                {item.message ? (
                                  <div className="folder-entry-sub muted">{item.message}</div>
                                ) : null}
                              </td>
                              <td className="folder-status-cell">
                                <StatusBadge tone={toneForFolderStatus(item.status)}>
                                  {formatFolderStatusLabel(item.status)}
                                </StatusBadge>
                              </td>
                              <td>{formatFolderSide(item.leftExists, item.leftKind, item.leftSize)}</td>
                              <td>{formatFolderSide(item.rightExists, item.rightKind, item.rightSize)}</td>
                              <td>
                                {enterable ? (
                                  <button
                                    type="button"
                                    className="folder-action-button button-secondary button-compact"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void navigateFolderPath(item.relativePath)
                                    }}
                                    disabled={loading}
                                  >
                                    Enter
                                  </button>
                                ) : openable ? (
                                  <button
                                    type="button"
                                    className="folder-action-button button-secondary button-compact"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void openFolderEntryDiff(item)
                                    }}
                                    disabled={folderOpenBusyPath === item.relativePath}
                                  >
                                    {folderOpenBusyPath === item.relativePath ? 'Opening...' : 'Open diff'}
                                  </button>
                                ) : (
                                  <span className="folder-action-reason muted">{actionReason ?? '—'}</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="folder-tree-wrap">
                  {flattenedFolderTreeRows.length === 0 ? (
                    <div className="muted">No entries to show.</div>
                  ) : (
                    <div className="folder-tree" role="tree">
                      {flattenedFolderTreeRows.map(({ node, depth }) => {
                        const openable = canOpenFolderItem(node.item)
                        const enterable = node.isDir && node.item.status !== 'type-mismatch'
                        const actionReason = getFolderItemActionReason(node.item)
                        const selected = node.path === selectedFolderItemPath
                        const loadingNode = folderTreeLoadingPath === node.path

                        return (
                          <div
                            key={node.path}
                            role="treeitem"
                            aria-expanded={node.isDir ? !!node.expanded : undefined}
                            className={`folder-tree-row ${
                              selected ? 'is-selected' : ''
                            } ${enterable || openable ? 'folder-row-clickable' : ''}`}
                            onClick={() => setSelectedFolderItemPath(node.path)}
                            onDoubleClick={() => void handleFolderTreeRowDoubleClick(node)}
                          >
                            <div
                              className={`folder-tree-name ${node.isDir ? 'is-dir' : 'is-file'} ${
                                openable ? 'is-openable' : ''
                              }`}
                            >
                              <span
                                className="folder-tree-indent"
                                style={{ ['--tree-depth' as string]: depth }}
                                aria-hidden="true"
                              />
                              {enterable ? (
                                <button
                                  type="button"
                                  className="folder-tree-chevron"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void toggleFolderTreeNode(node)
                                  }}
                                  aria-label={node.expanded ? 'Collapse directory' : 'Expand directory'}
                                >
                                  {node.expanded ? (
                                    <IconChevronDown size={14} />
                                  ) : (
                                    <IconChevronRight size={14} />
                                  )}
                                </button>
                              ) : (
                                <span className="folder-tree-chevron-spacer" />
                              )}
                              {node.isDir ? <IconFolderOpen size={14} /> : <IconFile size={14} />}
                              <span className="folder-entry-path">{node.name}</span>
                              <span className="folder-tree-status folder-status-cell">
                                <StatusBadge tone={toneForFolderStatus(node.status)}>
                                  {formatFolderStatusLabel(node.status)}
                                </StatusBadge>
                              </span>
                            </div>
                            <div className="folder-tree-secondary">
                              {formatFolderSide(node.item.leftExists, node.item.leftKind, node.item.leftSize)} /{' '}
                              {formatFolderSide(node.item.rightExists, node.item.rightKind, node.item.rightSize)}
                            </div>
                            <div className="folder-tree-action">
                              {enterable ? (
                                <button
                                  type="button"
                                  className="folder-action-button button-secondary button-compact"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void toggleFolderTreeNode(node)
                                  }}
                                  disabled={loadingNode}
                                >
                                  {loadingNode ? 'Loading...' : node.expanded ? 'Collapse' : 'Enter'}
                                </button>
                              ) : openable ? (
                                <button
                                  type="button"
                                  className="folder-action-button button-secondary button-compact"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void openFolderEntryDiff(node.item)
                                  }}
                                  disabled={folderOpenBusyPath === node.path}
                                >
                                  {folderOpenBusyPath === node.path ? 'Opening...' : 'Open diff'}
                                </button>
                              ) : (
                                <span className="folder-action-reason muted">{actionReason ?? '—'}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            ) : (
              <pre className="result-output">(no directory result yet)</pre>
            )}
          </div>

          {shouldShowFolderDetail ? (
            <div className="folder-detail-pane folder-detail-card">
              <div className="folder-summary-title">Selected Entry</div>
              <div className="folder-detail-grid">
                <div className="folder-detail-label">Relative path</div>
                <div className="folder-entry-path">{selectedFolderItemForDetail.relativePath}</div>
                <div className="folder-detail-label">Status</div>
                <div className="folder-status-cell">
                  <StatusBadge tone={toneForFolderStatus(selectedFolderItemForDetail.status)}>
                    {formatFolderStatusLabel(selectedFolderItemForDetail.status)}
                  </StatusBadge>
                </div>
                <div className="folder-detail-label">Left path</div>
                <div className="folder-entry-path">{selectedFolderItemForDetail.leftPath || '(missing)'}</div>
                <div className="folder-detail-label">Right path</div>
                <div className="folder-entry-path">{selectedFolderItemForDetail.rightPath || '(missing)'}</div>
                <div className="folder-detail-label">Left kind</div>
                <div>{formatFolderKindLabel(selectedFolderItemForDetail.leftKind)}</div>
                <div className="folder-detail-label">Right kind</div>
                <div>{formatFolderKindLabel(selectedFolderItemForDetail.rightKind)}</div>
                <div className="folder-detail-label">Left size</div>
                <div>{selectedFolderItemForDetail.leftSize}</div>
                <div className="folder-detail-label">Right size</div>
                <div>{selectedFolderItemForDetail.rightSize}</div>
                <div className="folder-detail-label">Mode hint</div>
                <div>{selectedFolderItemForDetail.compareModeHint}</div>
                {selectedFolderItemForDetail.message ? (
                  <>
                    <div className="folder-detail-label">Message</div>
                    <div>{selectedFolderItemForDetail.message}</div>
                  </>
                ) : null}
              </div>
              <div className="folder-detail-action">
                {selectedFolderItemForDetail.isDir &&
                selectedFolderItemForDetail.status !== 'type-mismatch' ? (
                  <button
                    type="button"
                    className="folder-action-button button-secondary button-compact"
                    onClick={() => void navigateFolderPath(selectedFolderItemForDetail.relativePath)}
                    disabled={
                      loading ||
                      folderTreeLoadingPath === selectedFolderItemForDetail.relativePath
                    }
                  >
                    Enter directory
                  </button>
                ) : canOpenFolderItem(selectedFolderItemForDetail) ? (
                  <button
                    type="button"
                    className="folder-action-button button-secondary button-compact"
                    onClick={() => void openFolderEntryDiff(selectedFolderItemForDetail)}
                    disabled={folderOpenBusyPath === selectedFolderItemForDetail.relativePath}
                  >
                    {folderOpenBusyPath === selectedFolderItemForDetail.relativePath
                      ? 'Opening...'
                      : 'Open diff'}
                  </button>
                ) : (
                  <div className="muted">{detailActionReason}</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>
    )
  }

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
