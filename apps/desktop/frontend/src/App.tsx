import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionIcon, Drawer, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAdjustmentsHorizontal,
  IconBackspace,
  IconChevronDown,
  IconChevronUp,
  IconClipboardText,
  IconCopy,
  IconFolderOpen,
  IconSwitchHorizontal,
} from '@tabler/icons-react'
import type {
  CompareCommon,
  CompareFoldersRequest,
  CompareFoldersResponse,
  CompareResponse,
  FolderCompareEntry,
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
import {
  HEADER_RAIL_ICON_SIZE,
  HeaderRailAction,
  HeaderRailGroup,
  HeaderRailPrimaryButton,
} from './ui/HeaderRail'
import { SectionCard } from './ui/SectionCard'
import { StatusBadge } from './ui/StatusBadge'

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

type TextResultView = 'rich' | 'raw'
type TextDiffLayout = 'split' | 'unified'
type TextInputTarget = 'old' | 'new'
type WailsRuntimeClipboard = {
  ClipboardGetText?: () => Promise<string>
  ClipboardSetText?: (text: string) => Promise<boolean>
}

type UnifiedDiffRowKind = 'meta' | 'hunk' | 'context' | 'add' | 'remove'
type InlineDiffKind = 'same' | 'add' | 'remove'

type InlineDiffSegment = {
  kind: InlineDiffKind
  text: string
}

type UnifiedDiffRow = {
  kind: UnifiedDiffRowKind
  oldLine: number | null
  newLine: number | null
  content: string
  inlineSegments?: InlineDiffSegment[]
}

type RichDiffItem =
  | {
      kind: 'row'
      row: UnifiedDiffRow
    }
  | {
      kind: 'omitted'
      sectionId: string
      startOldLine: number
      startNewLine: number
      lines: string[]
    }

type OmittedDiffItem = Extract<RichDiffItem, { kind: 'omitted' }>

type TextSearchMatch = {
  id: string
  sectionId: string | null
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

function renderResult(res: unknown): string {
  if (typeof res === 'string') return res
  if (!res) return '(no response)'

  const maybe = res as {
    error?: string
    output?: string
  }

  if (maybe.error) return String(maybe.error)
  if (maybe.output) return String(maybe.output)

  return JSON.stringify(res, null, 2)
}

function summarizeResponse(res: unknown): string {
  if (!res || typeof res !== 'object') return ''

  const r = res as {
    exitCode?: number
    diffFound?: boolean
    error?: string
    summary?: { total: number; ok: number; diff: number; error: number; exitCode: number }
  }

  if (r.summary) {
    return `exit=${r.summary.exitCode} total=${r.summary.total} ok=${r.summary.ok} diff=${r.summary.diff} error=${r.summary.error}`
  }

  const parts: string[] = []
  if (typeof r.exitCode === 'number') parts.push(`exit=${r.exitCode}`)
  if (typeof r.diffFound === 'boolean') parts.push(`diff=${r.diffFound ? 'yes' : 'no'}`)
  if (r.error) parts.push('error=yes')

  return parts.join(' ')
}

function shouldHideTextRichMetaRow(row: UnifiedDiffRow): boolean {
  return row.kind === 'meta' && (row.content.startsWith('--- ') || row.content.startsWith('+++ '))
}

function summarizeTextResultForGUI(res: CompareResponse | null): string {
  if (!res) {
    return '(no result yet)'
  }

  if (res.error) {
    return 'Execution error'
  }

  return res.diffFound ? 'Differences found' : 'No differences'
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

function toneForFolderStatus(
  status: FolderCompareEntry['status'],
): 'default' | 'success' | 'warning' | 'danger' | 'accent' {
  if (status === 'same') return 'success'
  if (status === 'changed') return 'warning'
  if (status === 'left-only' || status === 'right-only') return 'accent'
  if (status === 'error' || status === 'type-mismatch') return 'danger'
  return 'default'
}

function formatFolderStatusLabel(status: FolderCompareEntry['status']): string {
  switch (status) {
    case 'same':
      return 'same'
    case 'changed':
      return 'changed'
    case 'left-only':
      return 'left only'
    case 'right-only':
      return 'right only'
    case 'type-mismatch':
      return 'type mismatch'
    case 'error':
      return 'error'
    default:
      return status
  }
}

function formatFolderKindLabel(entry: FolderCompareEntry): string {
  if (entry.leftKind === entry.rightKind) {
    return entry.leftKind
  }
  return `${entry.leftKind} / ${entry.rightKind}`
}

function canOpenFolderEntry(entry: FolderCompareEntry): boolean {
  return (
    entry.compareModeHint !== 'none' &&
    entry.leftExists &&
    entry.rightExists &&
    entry.leftKind === 'file' &&
    entry.rightKind === 'file'
  )
}

function ignorePathsToText(paths: string[]): string {
  return paths.join('\n')
}

function parseIgnorePaths(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function getRuntimeClipboardRead(): (() => Promise<string>) | null {
  const runtimeClipboard = (window as Window & {
    runtime?: WailsRuntimeClipboard
  }).runtime

  return runtimeClipboard?.ClipboardGetText ?? null
}

function getRuntimeClipboardWrite(): ((text: string) => Promise<boolean>) | null {
  const runtimeClipboard = (window as Window & {
    runtime?: WailsRuntimeClipboard
  }).runtime

  return runtimeClipboard?.ClipboardSetText ?? null
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return String(error)
}

function tokenizeInlineDiff(input: string): string[] {
  if (input.length === 0) {
    return ['']
  }

  const tokens = input.match(/(\s+|[^\s]+)/g)
  return tokens && tokens.length > 0 ? tokens : [input]
}

function pushInlineSegment(
  target: InlineDiffSegment[],
  kind: InlineDiffKind,
  text: string,
) {
  if (text.length === 0) {
    return
  }

  const last = target[target.length - 1]
  if (last && last.kind === kind) {
    last.text += text
    return
  }

  target.push({ kind, text })
}

function buildLCSTable(a: string[], b: string[]): number[][] {
  const table = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  )

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        table[i][j] = table[i + 1][j + 1] + 1
      } else {
        table[i][j] = Math.max(table[i + 1][j], table[i][j + 1])
      }
    }
  }

  return table
}

function buildInlineDiffPair(
  oldText: string,
  newText: string,
): { removed: InlineDiffSegment[]; added: InlineDiffSegment[] } | null {
  if (oldText === newText) {
    return {
      removed: [{ kind: 'same', text: oldText }],
      added: [{ kind: 'same', text: newText }],
    }
  }

  if (oldText.length + newText.length > 4000) {
    return null
  }

  const oldTokens = tokenizeInlineDiff(oldText)
  const newTokens = tokenizeInlineDiff(newText)

  if (oldTokens.length * newTokens.length > 40000) {
    return null
  }

  const table = buildLCSTable(oldTokens, newTokens)
  const removed: InlineDiffSegment[] = []
  const added: InlineDiffSegment[] = []

  let i = 0
  let j = 0

  while (i < oldTokens.length && j < newTokens.length) {
    if (oldTokens[i] === newTokens[j]) {
      pushInlineSegment(removed, 'same', oldTokens[i])
      pushInlineSegment(added, 'same', newTokens[j])
      i++
      j++
      continue
    }

    if (table[i + 1][j] >= table[i][j + 1]) {
      pushInlineSegment(removed, 'remove', oldTokens[i])
      i++
      continue
    }

    pushInlineSegment(added, 'add', newTokens[j])
    j++
  }

  while (i < oldTokens.length) {
    pushInlineSegment(removed, 'remove', oldTokens[i])
    i++
  }

  while (j < newTokens.length) {
    pushInlineSegment(added, 'add', newTokens[j])
    j++
  }

  return { removed, added }
}

function addInlineDiffSegments(rows: UnifiedDiffRow[]): UnifiedDiffRow[] {
  const enriched = rows.map((row) => ({ ...row }))
  let index = 0

  while (index < enriched.length) {
    if (enriched[index].kind !== 'remove' && enriched[index].kind !== 'add') {
      index++
      continue
    }

    const removedIndexes: number[] = []
    const addedIndexes: number[] = []
    let end = index

    while (
      end < enriched.length &&
      (enriched[end].kind === 'remove' || enriched[end].kind === 'add')
    ) {
      if (enriched[end].kind === 'remove') {
        removedIndexes.push(end)
      } else {
        addedIndexes.push(end)
      }
      end++
    }

    const pairCount = Math.min(removedIndexes.length, addedIndexes.length)

    for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
      const removedRow = enriched[removedIndexes[pairIndex]]
      const addedRow = enriched[addedIndexes[pairIndex]]

      const pair = buildInlineDiffPair(removedRow.content, addedRow.content)
      if (!pair) {
        continue
      }

      removedRow.inlineSegments = pair.removed
      addedRow.inlineSegments = pair.added
    }

    index = end
  }

  return enriched
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

function parseUnifiedDiff(output: string): UnifiedDiffRow[] | null {
  const lines = output.split('\n')
  const rows: UnifiedDiffRow[] = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === lines.length - 1 && line === '') {
      continue
    }

    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      rows.push({ kind: 'meta', oldLine: null, newLine: null, content: line })
      continue
    }

    if (line.startsWith('@@ ')) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (!match) {
        return null
      }
      oldLine = Number(match[1])
      newLine = Number(match[2])
      inHunk = true
      rows.push({ kind: 'hunk', oldLine: null, newLine: null, content: line })
      continue
    }

    if (!inHunk) {
      rows.push({ kind: 'meta', oldLine: null, newLine: null, content: line })
      continue
    }

    if (line.startsWith('+')) {
      rows.push({
        kind: 'add',
        oldLine: null,
        newLine,
        content: line.slice(1),
      })
      newLine++
      continue
    }

    if (line.startsWith('-')) {
      rows.push({
        kind: 'remove',
        oldLine,
        newLine: null,
        content: line.slice(1),
      })
      oldLine++
      continue
    }

    if (line.startsWith(' ')) {
      rows.push({
        kind: 'context',
        oldLine,
        newLine,
        content: line.slice(1),
      })
      oldLine++
      newLine++
      continue
    }

    rows.push({ kind: 'meta', oldLine: null, newLine: null, content: line })
  }

  return addInlineDiffSegments(rows)
}

function splitTextForDisplay(input: string): string[] {
  const lines = input.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

function parseHunkHeader(content: string): {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
} | null {
  const match = content.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
  if (!match) {
    return null
  }

  return {
    oldStart: Number(match[1]),
    oldCount: match[2] ? Number(match[2]) : 1,
    newStart: Number(match[3]),
    newCount: match[4] ? Number(match[4]) : 1,
  }
}

function buildExpandedContextRow(
  content: string,
  oldLine: number,
  newLine: number,
): UnifiedDiffRow {
  return {
    kind: 'context',
    oldLine,
    newLine,
    content,
  }
}

function buildOmittedSectionID(
  oldStart: number,
  oldCount: number,
  newStart: number,
  newCount: number,
): string {
  return `omitted-${oldStart}-${oldCount}-${newStart}-${newCount}`
}

function pushOmittedItem(
  items: RichDiffItem[],
  oldLines: string[],
  newLines: string[],
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
) {
  const oldCount = oldEnd - oldStart + 1
  const newCount = newEnd - newStart + 1
  const count = Math.min(oldCount, newCount)

  if (count <= 0) {
    return
  }

  const lines = oldLines.slice(oldStart - 1, oldStart - 1 + count)
  if (lines.length === 0) {
    return
  }

  items.push({
    kind: 'omitted',
    sectionId: buildOmittedSectionID(oldStart, count, newStart, count),
    startOldLine: oldStart,
    startNewLine: newStart,
    lines,
  })
}

function buildRichDiffItems(
  rows: UnifiedDiffRow[],
  oldText: string,
  newText: string,
): RichDiffItem[] {
  const oldLines = splitTextForDisplay(oldText)
  const newLines = splitTextForDisplay(newText)
  const items: RichDiffItem[] = []

  let previousShownOld = 0
  let previousShownNew = 0
  let sawHunk = false

  for (const row of rows) {
    if (row.kind === 'hunk') {
      const parsed = parseHunkHeader(row.content)
      if (parsed) {
        sawHunk = true
        pushOmittedItem(
          items,
          oldLines,
          newLines,
          previousShownOld + 1,
          parsed.oldStart - 1,
          previousShownNew + 1,
          parsed.newStart - 1,
        )
      }

      items.push({ kind: 'row', row })
      continue
    }

    items.push({ kind: 'row', row })

    if (row.kind === 'context') {
      previousShownOld = row.oldLine ?? previousShownOld
      previousShownNew = row.newLine ?? previousShownNew
      continue
    }

    if (row.kind === 'remove') {
      previousShownOld = row.oldLine ?? previousShownOld
      continue
    }

    if (row.kind === 'add') {
      previousShownNew = row.newLine ?? previousShownNew
    }
  }

  if (sawHunk) {
    pushOmittedItem(
      items,
      oldLines,
      newLines,
      previousShownOld + 1,
      oldLines.length,
      previousShownNew + 1,
      newLines.length,
    )
  }

  return items
}

function buildTextSearchRowIDForItem(itemIndex: number): string {
  return `search-row-${itemIndex}`
}

function buildTextSearchRowIDForOmitted(sectionId: string, lineIndex: number): string {
  return `search-omitted-${sectionId}-${lineIndex}`
}

function normalizeSearchQuery(input: string): string {
  return input.trim().toLowerCase()
}

function isSearchableDiffRow(row: UnifiedDiffRow): boolean {
  return row.kind === 'context' || row.kind === 'add' || row.kind === 'remove'
}

function contentMatchesSearch(content: string, normalizedQuery: string): boolean {
  return normalizedQuery.length > 0 && content.toLowerCase().includes(normalizedQuery)
}

function buildTextSearchMatches(
  items: RichDiffItem[],
  normalizedQuery: string,
): TextSearchMatch[] {
  if (!normalizedQuery) {
    return []
  }

  const matches: TextSearchMatch[] = []

  items.forEach((item, itemIndex) => {
    if (item.kind === 'row') {
      if (!isSearchableDiffRow(item.row)) {
        return
      }

      if (contentMatchesSearch(item.row.content, normalizedQuery)) {
        matches.push({
          id: buildTextSearchRowIDForItem(itemIndex),
          sectionId: null,
        })
      }
      return
    }

    item.lines.forEach((line, lineIndex) => {
      if (!contentMatchesSearch(line, normalizedQuery)) {
        return
      }

      matches.push({
        id: buildTextSearchRowIDForOmitted(item.sectionId, lineIndex),
        sectionId: item.sectionId,
      })
    })
  })

  return matches
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

  const [jsonOldPath, setJSONOldPath] = useState('')
  const [jsonNewPath, setJSONNewPath] = useState('')
  const [ignoreOrder, setIgnoreOrder] = useState(false)
  const [jsonCommon, setJSONCommon] = useState<CompareCommon>(defaultJSONCommon)
  const [jsonIgnorePathsDraft, setJSONIgnorePathsDraft] = useState(() =>
    ignorePathsToText(defaultJSONCommon.ignorePaths),
  )

  const [specOldPath, setSpecOldPath] = useState('')
  const [specNewPath, setSpecNewPath] = useState('')
  const [specCommon, setSpecCommon] = useState<CompareCommon>(defaultSpecCommon)
  const [specIgnorePathsDraft, setSpecIgnorePathsDraft] = useState(() =>
    ignorePathsToText(defaultSpecCommon.ignorePaths),
  )

  const [textOld, setTextOld] = useState('')
  const [textNew, setTextNew] = useState('')
  const [textOldSourcePath, setTextOldSourcePath] = useState('')
  const [textNewSourcePath, setTextNewSourcePath] = useState('')
  const [textCommon, setTextCommon] = useState<CompareCommon>(defaultTextCommon)
  const [textResultView, setTextResultView] = useState<TextResultView>('rich')
  const [textDiffLayout, setTextDiffLayout] = useState<TextDiffLayout>('split')
  const [textResult, setTextResult] = useState<CompareResponse | null>(null)
  const [textLastRunOld, setTextLastRunOld] = useState('')
  const [textLastRunNew, setTextLastRunNew] = useState('')
  const [textLastRunOutputFormat, setTextLastRunOutputFormat] = useState<
    'text' | 'json' | null
  >(null)
  const [textExpandedUnchangedSectionIds, setTextExpandedUnchangedSectionIds] = useState<
    string[]
  >([])
  const [textSearchQuery, setTextSearchQuery] = useState('')
  const [textActiveSearchIndex, setTextActiveSearchIndex] = useState(0)
  const textSearchRowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [textClipboardBusyTarget, setTextClipboardBusyTarget] =
    useState<TextInputTarget | null>(null)
  const [textFileBusyTarget, setTextFileBusyTarget] = useState<TextInputTarget | null>(
    null,
  )
  const [textCopyBusy, setTextCopyBusy] = useState(false)

  const textEditorBusy = textClipboardBusyTarget !== null || textFileBusyTarget !== null

  const [folderLeftRoot, setFolderLeftRoot] = useState('')
  const [folderRightRoot, setFolderRightRoot] = useState('')
  const [folderRecursive, setFolderRecursive] = useState(true)
  const [folderShowSame, setFolderShowSame] = useState(false)
  const [folderNameFilter, setFolderNameFilter] = useState('')
  const [folderResult, setFolderResult] = useState<CompareFoldersResponse | null>(null)
  const [folderStatus, setFolderStatus] = useState('')
  const [folderOpenBusyPath, setFolderOpenBusyPath] = useState('')

  const [scenarioPath, setScenarioPath] = useState('')
  const [reportFormat, setReportFormat] = useState<'text' | 'json'>('text')
  const [scenarioChecks, setScenarioChecks] = useState<ScenarioCheckListEntry[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])
  const [scenarioListStatus, setScenarioListStatus] = useState('')
  const [scenarioRunResult, setScenarioRunResult] = useState<ScenarioRunResponse | null>(null)
  const [selectedScenarioResultName, setSelectedScenarioResultName] = useState('')

  const [summaryLine, setSummaryLine] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [compareOptionsOpened, setCompareOptionsOpened] = useState(false)

  const effectiveJSONIgnorePaths = parseIgnorePaths(jsonIgnorePathsDraft)
  const effectiveSpecIgnorePaths = parseIgnorePaths(specIgnorePathsDraft)
  const textRichRows = useMemo(
    () => (textResult?.output ? parseUnifiedDiff(textResult.output) : null),
    [textResult?.output],
  )
  const textRichItems = useMemo(
    () =>
      textRichRows ? buildRichDiffItems(textRichRows, textLastRunOld, textLastRunNew) : null,
    [textRichRows, textLastRunOld, textLastRunNew],
  )
  const normalizedTextSearchQuery = useMemo(
    () => normalizeSearchQuery(textSearchQuery),
    [textSearchQuery],
  )
  const textSearchMatches = useMemo(
    () =>
      textRichItems ? buildTextSearchMatches(textRichItems, normalizedTextSearchQuery) : [],
    [textRichItems, normalizedTextSearchQuery],
  )
  const textSearchMatchIds = useMemo(
    () => new Set(textSearchMatches.map((match) => match.id)),
    [textSearchMatches],
  )
  const activeTextSearchMatch = textSearchMatches[textActiveSearchIndex] ?? null
  const omittedSectionIds = useMemo(
    () =>
      textRichItems?.flatMap((item) => (item.kind === 'omitted' ? [item.sectionId] : [])) ?? [],
    [textRichItems],
  )
  const allOmittedSectionsExpanded =
    omittedSectionIds.length > 0 &&
    omittedSectionIds.every((id) => textExpandedUnchangedSectionIds.includes(id))
  const effectiveExpandedSectionIds = useMemo(() => {
    const ids = new Set(textExpandedUnchangedSectionIds)
    if (activeTextSearchMatch?.sectionId) {
      ids.add(activeTextSearchMatch.sectionId)
    }
    return [...ids]
  }, [textExpandedUnchangedSectionIds, activeTextSearchMatch?.sectionId])
  const canRenderTextRich =
    textLastRunOutputFormat === 'text' &&
    !!textResult &&
    !textResult.error &&
    !!textRichRows

  const jsonPatchBlockedByFilters =
    ignoreOrder || jsonCommon.onlyBreaking || effectiveJSONIgnorePaths.length > 0

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
    if (!textResult) {
      return
    }

    if (textResultView === 'rich' && !canRenderTextRich) {
      setTextResultView('raw')
    }
  }, [canRenderTextRich, textResult, textResultView])

  useEffect(() => {
    setTextActiveSearchIndex(0)
  }, [normalizedTextSearchQuery, textResult?.output])

  useEffect(() => {
    if (textSearchMatches.length === 0) {
      if (textActiveSearchIndex !== 0) {
        setTextActiveSearchIndex(0)
      }
      return
    }

    if (textActiveSearchIndex >= textSearchMatches.length) {
      setTextActiveSearchIndex(0)
    }
  }, [textSearchMatches.length, textActiveSearchIndex])

  useEffect(() => {
    if (textResultView !== 'rich' || !canRenderTextRich || !activeTextSearchMatch) {
      return
    }

    const node = textSearchRowRefs.current[activeTextSearchMatch.id]
    if (node) {
      node.scrollIntoView({ block: 'center' })
    }
  }, [
    activeTextSearchMatch?.id,
    canRenderTextRich,
    textDiffLayout,
    textResultView,
    effectiveExpandedSectionIds.join('|'),
  ])

  useEffect(() => {
    setTextExpandedUnchangedSectionIds((prev) =>
      prev.filter((id) => omittedSectionIds.includes(id)),
    )
  }, [omittedSectionIds])

  const api = useMemo(
    () => ({
      compareJSON: (window as any).go?.main?.App?.CompareJSONFiles,
      compareSpec: (window as any).go?.main?.App?.CompareSpecFiles,
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
    }),
    [],
  )

  const setResult = (res: unknown) => {
    setSummaryLine(summarizeResponse(res))
    setOutput(renderResult(res))
  }

  const updateJSONCommon = <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
    setJSONCommon((prev) => ({ ...prev, [key]: value }))
  }

  const updateSpecCommon = <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
    setSpecCommon((prev) => ({ ...prev, [key]: value }))
  }

  const updateTextCommon = <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
    setTextCommon((prev) => ({ ...prev, [key]: value }))
  }

  const isTextSectionExpanded = (sectionId: string) =>
    effectiveExpandedSectionIds.includes(sectionId)

  const isTextSearchMatchId = (matchId: string) => textSearchMatchIds.has(matchId)

  const isActiveTextSearchMatchId = (matchId: string) => activeTextSearchMatch?.id === matchId

  const registerTextSearchRowRef = (matchId: string) => (node: HTMLDivElement | null) => {
    if (node) {
      textSearchRowRefs.current[matchId] = node
      return
    }

    delete textSearchRowRefs.current[matchId]
  }

  const getTextSearchClassName = (matchId: string) => {
    if (!isTextSearchMatchId(matchId)) {
      return ''
    }

    return isActiveTextSearchMatchId(matchId) ? 'active-search-hit' : 'search-hit'
  }

  const moveTextSearch = (direction: 1 | -1) => {
    if (!canRenderTextRich || textSearchMatches.length === 0) {
      return
    }

    if (textResultView !== 'rich') {
      setTextResultView('rich')
    }

    setTextActiveSearchIndex((prev) =>
      direction === 1
        ? (prev + 1) % textSearchMatches.length
        : (prev - 1 + textSearchMatches.length) % textSearchMatches.length,
    )
  }

  const toggleTextUnchangedSection = (sectionId: string) => {
    setTextExpandedUnchangedSectionIds((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    )
  }

  const toggleAllTextUnchangedSections = () => {
    setTextExpandedUnchangedSectionIds(allOmittedSectionsExpanded ? [] : omittedSectionIds)
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
      setFolderStatus('Folder picker is not available.')
      notifications.show({
        title: 'Folder picker unavailable',
        message: 'Folder picker is not available.',
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

      setFolderStatus('')
    } catch (error) {
      const message = `Failed to pick folder: ${formatUnknownError(error)}`
      setFolderStatus(message)
      notifications.show({
        title: 'Failed to pick folder',
        message,
        color: 'red',
      })
    }
  }

  const runFolderCompare = async () => {
    const fn = api.compareFolders
    if (!fn) throw new Error('Wails bridge not available (CompareFolders)')

    setFolderStatus('')

    const res: CompareFoldersResponse = await fn({
      leftRoot: folderLeftRoot,
      rightRoot: folderRightRoot,
      recursive: folderRecursive,
      showSame: folderShowSame,
      nameFilter: folderNameFilter,
    } satisfies CompareFoldersRequest)

    setFolderResult(res)

    if (res.error) {
      setFolderStatus(res.error)
      return
    }

    setFolderStatus(`Showing ${res.entries.length} entries.`)
  }

  const openFolderEntryDiff = async (entry: FolderCompareEntry) => {
    if (!canOpenFolderEntry(entry)) {
      return
    }

    setFolderOpenBusyPath(entry.relativePath)
    setFolderStatus('')

    try {
      if (entry.compareModeHint === 'json') {
        const fn = api.compareJSON
        if (!fn) {
          throw new Error('Wails bridge not available (CompareJSONFiles)')
        }

        const safeJSONCommon = {
          ...jsonCommon,
          ignorePaths: effectiveJSONIgnorePaths,
          textStyle:
            jsonCommon.textStyle === 'patch' && jsonPatchBlockedByFilters
              ? 'semantic'
              : jsonCommon.textStyle,
        }

        const oldPath = entry.leftPath
        const newPath = entry.rightPath

        const res: CompareResponse = await fn({
          oldPath,
          newPath,
          common: safeJSONCommon,
          ignoreOrder,
        })

        setJSONOldPath(oldPath)
        setJSONNewPath(newPath)
        setMode('json')
        setResult(res)
        return
      }

      if (entry.compareModeHint === 'spec') {
        const fn = api.compareSpec
        if (!fn) {
          throw new Error('Wails bridge not available (CompareSpecFiles)')
        }

        const safeSpecCommon = {
          ...specCommon,
          ignorePaths: effectiveSpecIgnorePaths,
          textStyle: specCommon.textStyle === 'patch' ? 'semantic' : specCommon.textStyle,
        }

        const oldPath = entry.leftPath
        const newPath = entry.rightPath

        const res: CompareResponse = await fn({
          oldPath,
          newPath,
          common: safeSpecCommon,
        })

        setSpecOldPath(oldPath)
        setSpecNewPath(newPath)
        setMode('spec')
        setResult(res)
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
      setTextExpandedUnchangedSectionIds([])
      setTextSearchQuery('')
      setTextActiveSearchIndex(0)
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

  const runJSON = async () => {
    const fn = api.compareJSON
    if (!fn) throw new Error('Wails bridge not available (CompareJSONFiles)')

    const safeJSONCommon = {
      ...jsonCommon,
      ignorePaths: effectiveJSONIgnorePaths,
      textStyle:
        jsonCommon.textStyle === 'patch' && jsonPatchBlockedByFilters
          ? 'semantic'
          : jsonCommon.textStyle,
    }

    const res: CompareResponse = await fn({
      oldPath: jsonOldPath,
      newPath: jsonNewPath,
      common: safeJSONCommon,
      ignoreOrder,
    })
    setResult(res)
  }

  const runSpec = async () => {
    const fn = api.compareSpec
    if (!fn) throw new Error('Wails bridge not available (CompareSpecFiles)')

    const safeSpecCommon = {
      ...specCommon,
      ignorePaths: effectiveSpecIgnorePaths,
      textStyle: specCommon.textStyle === 'patch' ? 'semantic' : specCommon.textStyle,
    }

    const res: CompareResponse = await fn({
      oldPath: specOldPath,
      newPath: specNewPath,
      common: safeSpecCommon,
    })
    setResult(res)
  }

  const runText = async () => {
    const fn = api.compareText
    if (!fn) throw new Error('Wails bridge not available (CompareText)')
    setTextExpandedUnchangedSectionIds([])

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

  const swapTextInputs = () => {
    setTextOld(textNew)
    setTextNew(textOld)
    setTextOldSourcePath(textNewSourcePath)
    setTextNewSourcePath(textOldSourcePath)
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
      setTextExpandedUnchangedSectionIds([])
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

  const renderUnifiedOmittedBlock = (item: OmittedDiffItem) => {
    const expanded = isTextSectionExpanded(item.sectionId)

    return (
      <div key={item.sectionId} className="text-omitted-block">
        <div className={`text-omitted-banner ${expanded ? 'expanded' : ''}`}>
          <span className="muted">{item.lines.length} unchanged lines</span>
          <button
            type="button"
            className="text-omitted-action button-secondary button-compact"
            onClick={() => toggleTextUnchangedSection(item.sectionId)}
          >
            {expanded ? 'Collapse unchanged' : 'Show hidden lines'}
          </button>
        </div>

        {expanded
          ? item.lines.map((line, index) => {
            const row = buildExpandedContextRow(
              line,
              item.startOldLine + index,
              item.startNewLine + index,
            )
            const matchId = buildTextSearchRowIDForOmitted(item.sectionId, index)
            const searchClassName = getTextSearchClassName(matchId)

            return (
              <div
                key={`${item.sectionId}-${index}`}
                ref={isTextSearchMatchId(matchId) ? registerTextSearchRowRef(matchId) : undefined}
                className={['text-diff-row', row.kind, searchClassName].filter(Boolean).join(' ')}
              >
                <div className="text-diff-line">{row.oldLine ?? ''}</div>
                <div className="text-diff-line">{row.newLine ?? ''}</div>
                <pre className="text-diff-content">{row.content}</pre>
              </div>
            )
          })
          : null}
      </div>
    )
  }

  const renderSplitOmittedBlock = (item: OmittedDiffItem) => {
    const expanded = isTextSectionExpanded(item.sectionId)

    return (
      <div key={item.sectionId} className="split-omitted-block">
        <div className="split-diff-banner omitted">
          <div className="split-omitted-banner-inner">
            <span className="muted">{item.lines.length} unchanged lines</span>
            <button
              type="button"
              className="text-omitted-action button-secondary button-compact"
              onClick={() => toggleTextUnchangedSection(item.sectionId)}
            >
              {expanded ? 'Collapse unchanged' : 'Show hidden lines'}
            </button>
          </div>
        </div>

        {expanded
          ? item.lines.map((line, index) => {
            const row = buildExpandedContextRow(
              line,
              item.startOldLine + index,
              item.startNewLine + index,
            )
            const matchId = buildTextSearchRowIDForOmitted(item.sectionId, index)
            const searchClassName = getTextSearchClassName(matchId)

            return (
              <div key={`${item.sectionId}-${index}`} className="split-diff-row">
                {renderSplitDiffCell(
                  row,
                  'left',
                  `split-omitted-left-${item.sectionId}-${index}`,
                  searchClassName,
                  isTextSearchMatchId(matchId) ? registerTextSearchRowRef(matchId) : undefined,
                )}
                {renderSplitDiffCell(
                  row,
                  'right',
                  `split-omitted-right-${item.sectionId}-${index}`,
                  searchClassName,
                )}
              </div>
            )
          })
          : null}
      </div>
    )
  }

  const renderTextDiffRows = (items: RichDiffItem[]) => {
    return (
      <div className="text-diff-grid">
        {items.map((item, idx) => {
          if (item.kind === 'omitted') {
            return renderUnifiedOmittedBlock(item)
          }

          const row = item.row
          if (shouldHideTextRichMetaRow(row)) {
            return null
          }

          const matchId = buildTextSearchRowIDForItem(idx)
          const searchClassName = getTextSearchClassName(matchId)
          return (
            <div
              key={`${idx}-${row.kind}`}
              ref={isTextSearchMatchId(matchId) ? registerTextSearchRowRef(matchId) : undefined}
              className={['text-diff-row', row.kind, searchClassName].filter(Boolean).join(' ')}
            >
              <div className="text-diff-line">{row.oldLine ?? ''}</div>
              <div className="text-diff-line">{row.newLine ?? ''}</div>
              <pre className="text-diff-content">
                {renderInlineDiffContent(row, `text-diff-${idx}`)}
              </pre>
            </div>
          )
        })}
      </div>
    )
  }

  const renderTextSplitRows = (items: RichDiffItem[]) => {
    const splitNodes: JSX.Element[] = []
    let index = 0

    while (index < items.length) {
      const item = items[index]

      if (item.kind === 'omitted') {
        splitNodes.push(renderSplitOmittedBlock(item))
        index++
        continue
      }

      const row = item.row

      if (row.kind === 'meta' || row.kind === 'hunk') {
        if (shouldHideTextRichMetaRow(row)) {
          index++
          continue
        }

        splitNodes.push(
          <div key={`split-banner-${index}`} className={`split-diff-banner ${row.kind}`}>
            <pre className="split-diff-banner-content">{row.content}</pre>
          </div>,
        )
        index++
        continue
      }

      if (row.kind === 'context') {
        const matchId = buildTextSearchRowIDForItem(index)
        const searchClassName = getTextSearchClassName(matchId)

        splitNodes.push(
          <div key={`split-row-${index}`} className="split-diff-row">
            {renderSplitDiffCell(
              row,
              'left',
              `split-left-${index}`,
              searchClassName,
              isTextSearchMatchId(matchId) ? registerTextSearchRowRef(matchId) : undefined,
            )}
            {renderSplitDiffCell(row, 'right', `split-right-${index}`, searchClassName)}
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

        const matchId = buildTextSearchRowIDForItem(end)

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

        splitNodes.push(
          <div key={`split-pair-${index}-${pairIndex}`} className="split-diff-row">
            {renderSplitDiffCell(
              left?.row ?? null,
              'left',
              `split-left-${index}-${pairIndex}`,
              left ? getTextSearchClassName(left.matchId) : '',
              left && isTextSearchMatchId(left.matchId)
                ? registerTextSearchRowRef(left.matchId)
                : undefined,
            )}
            {renderSplitDiffCell(
              right?.row ?? null,
              'right',
              `split-right-${index}-${pairIndex}`,
              right ? getTextSearchClassName(right.matchId) : '',
              right && isTextSearchMatchId(right.matchId)
                ? registerTextSearchRowRef(right.matchId)
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

  const renderTextResultPanel = () => {
    const raw = textResult ? renderResult(textResult) : ''
    const hasTextResult = !!textResult
    const showRich = textResultView === 'rich' && canRenderTextRich && !!textRichItems

    return (
      <div className="text-result-shell">
        {hasTextResult ? (
          <div className="result-summary">{summarizeTextResultForGUI(textResult)}</div>
        ) : null}

        <div className="text-result-toolbar">
          <div className="text-result-controls">
            <div className="text-result-tabs">
              <button
                type="button"
                className={`button-secondary button-compact ${textResultView === 'rich' ? 'active' : ''}`}
                onClick={() => setTextResultView('rich')}
                disabled={!canRenderTextRich}
              >
                Rich diff
              </button>
              <button
                type="button"
                className={`button-secondary button-compact ${textResultView === 'raw' ? 'active' : ''}`}
                onClick={() => setTextResultView('raw')}
              >
                Raw output
              </button>
            </div>

            <div className="text-diff-layout-tabs">
              <button
                type="button"
                className={`button-secondary button-compact ${textDiffLayout === 'split' ? 'active' : ''}`}
                onClick={() => setTextDiffLayout('split')}
                disabled={!canRenderTextRich}
              >
                Split
              </button>
              <button
                type="button"
                className={`button-secondary button-compact ${textDiffLayout === 'unified' ? 'active' : ''}`}
                onClick={() => setTextDiffLayout('unified')}
                disabled={!canRenderTextRich}
              >
                Unified
              </button>
            </div>

            {showRich ? (
              <div className="text-search-controls">
                <input
                  type="text"
                  className="text-search-input"
                  placeholder="Search rich diff"
                  value={textSearchQuery}
                  onChange={(e) => setTextSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      moveTextSearch(e.shiftKey ? -1 : 1)
                      return
                    }

                    if (e.key === 'Escape') {
                      setTextSearchQuery('')
                    }
                  }}
                />

                <span className="muted text-search-status">
                  {normalizedTextSearchQuery
                    ? textSearchMatches.length > 0
                      ? `${textActiveSearchIndex + 1} / ${textSearchMatches.length} matching rows`
                      : '0 matching rows'
                    : 'Search rich diff'}
                </span>

                <Tooltip label="Previous match">
                  <ActionIcon
                    variant="default"
                    size={28}
                    aria-label="Previous match"
                    className="text-search-action"
                    onClick={() => moveTextSearch(-1)}
                    disabled={textSearchMatches.length === 0}
                  >
                    <IconChevronUp size={15} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="Next match">
                  <ActionIcon
                    variant="default"
                    size={28}
                    aria-label="Next match"
                    className="text-search-action"
                    onClick={() => moveTextSearch(1)}
                    disabled={textSearchMatches.length === 0}
                  >
                    <IconChevronDown size={15} />
                  </ActionIcon>
                </Tooltip>
              </div>
            ) : null}

            {showRich && omittedSectionIds.length > 0 ? (
              <button
                type="button"
                className="text-unchanged-toggle button-secondary button-compact"
                onClick={toggleAllTextUnchangedSections}
              >
                {allOmittedSectionsExpanded ? 'Collapse unchanged' : 'Expand unchanged'}
              </button>
            ) : null}
          </div>

          <Tooltip label="Copy raw output">
            <ActionIcon
              variant="default"
              size={28}
              aria-label="Copy raw output"
              className="text-result-action"
              onClick={() => void copyTextResultRawOutput()}
              disabled={textCopyBusy || !raw}
              loading={textCopyBusy}
            >
              <IconCopy size={15} />
            </ActionIcon>
          </Tooltip>
        </div>

        <div className="text-result-body">
          {!hasTextResult ? (
            <pre className="result-output">(no result yet)</pre>
          ) : showRich && textRichItems ? (
            textDiffLayout === 'split' ? (
              renderTextSplitRows(textRichItems)
            ) : (
              renderTextDiffRows(textRichItems)
            )
          ) : (
            <pre className="result-output">{raw}</pre>
          )}
        </div>
      </div>
    )
  }

  const renderFolderResultPanel = () => {
    const res = folderResult

    return (
      <SectionCard title="Folder Compare">
        <div className="folder-result-shell">

          {folderStatus ? <div className="muted">{folderStatus}</div> : null}

          {res?.error ? (
            <pre className="result-output">{res.error}</pre>
          ) : res ? (
            <>
              <div className="folder-summary-grid">
                <div className="folder-summary-item">
                  <div className="folder-summary-label">Total</div>
                  <div className="folder-summary-value">{res.summary.total}</div>
                </div>
                <div className="folder-summary-item">
                  <div className="folder-summary-label">Changed</div>
                  <div className="folder-summary-value">{res.summary.changed}</div>
                </div>
                <div className="folder-summary-item">
                  <div className="folder-summary-label">Same</div>
                  <div className="folder-summary-value">{res.summary.same}</div>
                </div>
                <div className="folder-summary-item">
                  <div className="folder-summary-label">Left only</div>
                  <div className="folder-summary-value">{res.summary.leftOnly}</div>
                </div>
                <div className="folder-summary-item">
                  <div className="folder-summary-label">Right only</div>
                  <div className="folder-summary-value">{res.summary.rightOnly}</div>
                </div>
                <div className="folder-summary-item">
                  <div className="folder-summary-label">Type mismatch</div>
                  <div className="folder-summary-value">{res.summary.typeMismatch}</div>
                </div>
                <div className="folder-summary-item">
                  <div className="folder-summary-label">Error</div>
                  <div className="folder-summary-value">{res.summary.error}</div>
                </div>
              </div>

              <div className="folder-table-wrap">
                <table className="folder-results-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Path</th>
                      <th>Kind</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.entries.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          <div className="muted">No entries to show.</div>
                        </td>
                      </tr>
                    ) : (
                      res.entries.map((entry) => {
                        const openable = canOpenFolderEntry(entry)
                        return (
                          <tr key={entry.relativePath}>
                            <td>
                              <StatusBadge tone={toneForFolderStatus(entry.status)}>
                                {formatFolderStatusLabel(entry.status)}
                              </StatusBadge>
                            </td>
                            <td>
                              <div
                                className="folder-entry-path"
                                title={`${entry.leftPath || '(missing)'}\n${entry.rightPath || '(missing)'}`}
                              >
                                {entry.relativePath}
                              </div>
                              {entry.message ? (
                                <div className="folder-entry-sub muted">{entry.message}</div>
                              ) : null}
                            </td>
                            <td>{formatFolderKindLabel(entry)}</td>
                            <td>
                              {openable ? (
                                <button
                                  type="button"
                                  className="folder-action-button button-secondary button-compact"
                                  onClick={() => void openFolderEntryDiff(entry)}
                                  disabled={folderOpenBusyPath === entry.relativePath}
                                >
                                  {folderOpenBusyPath === entry.relativePath
                                    ? 'Opening...'
                                    : 'Open diff'}
                                </button>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <pre className="result-output">(no folder result yet)</pre>
          )}
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

  const compareModeHeaderActions = isCompareCentricMode ? (
    <HeaderRailGroup>
      <HeaderRailPrimaryButton onClick={() => void onRun()} loading={loading}>
        Compare
      </HeaderRailPrimaryButton>
      <Tooltip label="Show compare options">
        <HeaderRailAction
          aria-label="Show compare options"
          onClick={() => setCompareOptionsOpened(true)}
        >
          <IconAdjustmentsHorizontal size={HEADER_RAIL_ICON_SIZE} />
        </HeaderRailAction>
      </Tooltip>
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
    mode === 'folder' ? (
      <section className="mode-panel">
        <div className="field-block">
          <label className="field-label">Left root</label>
          <div className="path-row">
            <input value={folderLeftRoot} onChange={(e) => setFolderLeftRoot(e.target.value)} />
            <button
              type="button"
              className="button-secondary"
              onClick={() => void browseFolderRoot('left')}
            >
              Browse...
            </button>
          </div>
        </div>

        <div className="field-block">
          <label className="field-label">Right root</label>
          <div className="path-row">
            <input value={folderRightRoot} onChange={(e) => setFolderRightRoot(e.target.value)} />
            <button
              type="button"
              className="button-secondary"
              onClick={() => void browseFolderRoot('right')}
            >
              Browse...
            </button>
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={folderRecursive}
            onChange={(e) => setFolderRecursive(e.target.checked)}
          />
          recursive
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={folderShowSame}
            onChange={(e) => setFolderShowSame(e.target.checked)}
          />
          show same
        </label>

        <div className="field-block">
          <label className="field-label">Name filter</label>
          <input
            value={folderNameFilter}
            onChange={(e) => setFolderNameFilter(e.target.value)}
            placeholder="case-insensitive substring"
          />
        </div>

        <button
          className="button-primary"
          onClick={onRun}
          disabled={loading || !folderLeftRoot || !folderRightRoot}
        >
          {loading ? 'Comparing...' : 'Compare folders'}
        </button>
      </section>
    ) : mode === 'scenario' ? (
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

  const mainContent =
    mode === 'text' ? (
      <div className="compare-mode-main">
        <div className="text-workspace">
          <div className="text-editors-row">
            <div className="text-editor-panel">
              <div className="text-editor-header">
                <div className="text-editor-title">
                  <label className="field-label">Old text</label>
                  <div className="text-source-path-slot">
                    {textOldSourcePath ? (
                      <div className="muted text-source-path" title={textOldSourcePath}>
                        {textOldSourcePath}
                      </div>
                    ) : (
                      <div className="text-source-path text-source-path-empty" aria-hidden="true" />
                    )}
                  </div>
                </div>
                <div className="text-editor-actions">
                  <Tooltip label="Open file into Old text">
                    <ActionIcon
                      variant="default"
                      size={28}
                      aria-label="Open file into Old text"
                      className="text-editor-action"
                      onClick={() => void loadTextFromFile('old')}
                      disabled={textEditorBusy}
                      loading={textFileBusyTarget === 'old'}
                    >
                      <IconFolderOpen size={15} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Paste clipboard into Old text">
                    <ActionIcon
                      variant="default"
                      size={28}
                      aria-label="Paste clipboard into Old text"
                      className="text-editor-action"
                      onClick={() => void pasteTextFromClipboard('old')}
                      disabled={textEditorBusy}
                      loading={textClipboardBusyTarget === 'old'}
                    >
                      <IconClipboardText size={15} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Clear Old text">
                    <ActionIcon
                      variant="default"
                      size={28}
                      aria-label="Clear Old text"
                      className="text-editor-action"
                      onClick={() => clearTextInput('old')}
                      disabled={textEditorBusy || !textOld}
                    >
                      <IconBackspace size={15} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Swap old and new texts">
                    <ActionIcon
                      variant="default"
                      size={28}
                      aria-label="Swap sides"
                      className="text-editor-action"
                      onClick={swapTextInputs}
                      disabled={textEditorBusy}
                    >
                      <IconSwitchHorizontal size={15} />
                    </ActionIcon>
                  </Tooltip>
                </div>
              </div>
              <textarea
                className="text-editor"
                value={textOld}
                onChange={(e) => {
                  setTextOld(e.target.value)
                  if (textOldSourcePath) setTextOldSourcePath('')
                }}
              />
            </div>
            <div className="text-editor-panel">
              <div className="text-editor-header">
                <div className="text-editor-title">
                  <label className="field-label">New text</label>
                  <div className="text-source-path-slot">
                    {textNewSourcePath ? (
                      <div className="muted text-source-path" title={textNewSourcePath}>
                        {textNewSourcePath}
                      </div>
                    ) : (
                      <div className="text-source-path text-source-path-empty" aria-hidden="true" />
                    )}
                  </div>
                </div>
                <div className="text-editor-actions">
                  <Tooltip label="Open file into New text">
                    <ActionIcon
                      variant="default"
                      size={28}
                      aria-label="Open file into New text"
                      className="text-editor-action"
                      onClick={() => void loadTextFromFile('new')}
                      disabled={textEditorBusy}
                      loading={textFileBusyTarget === 'new'}
                    >
                      <IconFolderOpen size={15} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Paste clipboard into New text">
                    <ActionIcon
                      variant="default"
                      size={28}
                      aria-label="Paste clipboard into New text"
                      className="text-editor-action"
                      onClick={() => void pasteTextFromClipboard('new')}
                      disabled={textEditorBusy}
                      loading={textClipboardBusyTarget === 'new'}
                    >
                      <IconClipboardText size={15} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Clear New text">
                    <ActionIcon
                      variant="default"
                      size={28}
                      aria-label="Clear New text"
                      className="text-editor-action"
                      onClick={() => clearTextInput('new')}
                      disabled={textEditorBusy || !textNew}
                    >
                      <IconBackspace size={15} />
                    </ActionIcon>
                  </Tooltip>
                </div>
              </div>
              <textarea
                className="text-editor"
                value={textNew}
                onChange={(e) => {
                  setTextNew(e.target.value)
                  if (textNewSourcePath) setTextNewSourcePath('')
                }}
              />
            </div>
          </div>
          {renderTextResultPanel()}
        </div>
      </div>
    ) : mode === 'json' ? (
      <div className="compare-mode-main">
        <SectionCard title="JSON sources">
          <div className="compare-source-panel">
            <div className="compare-source-grid">
              <div className="field-block">
                <label className="field-label">Old path</label>
                <div className="path-row">
                  <input value={jsonOldPath} onChange={(e) => setJSONOldPath(e.target.value)} />
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => browseAndSet(api.pickJSONFile, setJSONOldPath)}
                  >
                    Browse...
                  </button>
                </div>
              </div>
              <div className="field-block">
                <label className="field-label">New path</label>
                <div className="path-row">
                  <input value={jsonNewPath} onChange={(e) => setJSONNewPath(e.target.value)} />
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => browseAndSet(api.pickJSONFile, setJSONNewPath)}
                  >
                    Browse...
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Result">
          {summaryLine ? <div className="result-summary">{summaryLine}</div> : null}
          <pre className="result-output">{output || '(no output yet)'}</pre>
        </SectionCard>
      </div>
    ) : mode === 'spec' ? (
      <div className="compare-mode-main">
        <SectionCard title="Spec sources">
          <div className="compare-source-panel">
            <div className="compare-source-grid">
              <div className="field-block">
                <label className="field-label">Old spec path</label>
                <div className="path-row">
                  <input value={specOldPath} onChange={(e) => setSpecOldPath(e.target.value)} />
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => browseAndSet(api.pickSpecFile, setSpecOldPath)}
                  >
                    Browse...
                  </button>
                </div>
              </div>
              <div className="field-block">
                <label className="field-label">New spec path</label>
                <div className="path-row">
                  <input value={specNewPath} onChange={(e) => setSpecNewPath(e.target.value)} />
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => browseAndSet(api.pickSpecFile, setSpecNewPath)}
                  >
                    Browse...
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Result">
          {summaryLine ? <div className="result-summary">{summaryLine}</div> : null}
          <pre className="result-output">{output || '(no output yet)'}</pre>
        </SectionCard>
      </div>
    ) : mode === 'folder' ? (
      <div className="result-panel">{renderFolderResultPanel()}</div>
    ) : (
      <div className="result-panel">
        <h2>Result</h2>
        {renderScenarioResultPanel()}
      </div>
    )

  return (
    <>
      <AppChrome
        mode={mode}
        onModeChange={(nextMode) => {
          setMode(nextMode)
          if (nextMode === 'folder' || nextMode === 'scenario') {
            setCompareOptionsOpened(false)
          }
        }}
        layoutMode={isCompareCentricMode ? 'workspace' : 'sidebar'}
        sidebar={isCompareCentricMode ? undefined : sidebarContent}
        headerActions={isCompareCentricMode ? compareModeHeaderActions : undefined}
        main={mainContent}
      />

      <Drawer
        opened={isCompareCentricMode && compareOptionsOpened}
        onClose={() => setCompareOptionsOpened(false)}
        position="right"
        size={360}
        title={compareOptionsTitle}
      >
        {compareOptionsContent}
      </Drawer>
    </>
  )
}
