import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
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
type JSONResultView = 'rich' | 'raw'
type TextDiffLayout = 'split' | 'unified'
type TextInputTarget = 'old' | 'new'
type FolderQuickFilter =
  | 'all'
  | 'changed'
  | 'left-only'
  | 'right-only'
  | 'type-mismatch'
  | 'error'
  | 'same'
type FolderSortKey = 'name' | 'status' | 'left' | 'right'
type FolderSortDirection = 'asc' | 'desc'
type FolderViewMode = 'list' | 'tree'
type FolderTreeNode = {
  path: string
  name: string
  isDir: boolean
  status: FolderCompareItem['status']
  item: FolderCompareItem
  children?: FolderTreeNode[]
  loaded?: boolean
  expanded?: boolean
}
type FolderTreeRow = {
  depth: number
  node: FolderTreeNode
}
type FolderReturnContext = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  selectedPath: string
  viewMode: FolderViewMode
}
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

function shouldShowTextHunkHeaders(items: RichDiffItem[]): boolean {
  const hunkCount = items.filter(
    (item) => item.kind === 'row' && item.row.kind === 'hunk',
  ).length
  const hasOmitted = items.some((item) => item.kind === 'omitted')
  return hunkCount > 1 || hasOmitted
}

function summarizeTextDiffCounts(rows: UnifiedDiffRow[] | null): {
  added: number
  removed: number
} {
  if (!rows) {
    return { added: 0, removed: 0 }
  }

  let added = 0
  let removed = 0

  for (const row of rows) {
    if (row.kind === 'add') {
      added++
    } else if (row.kind === 'remove') {
      removed++
    }
  }

  return { added, removed }
}

function buildTextSummaryBadgeItems(params: {
  hasResult: boolean
  hasError: boolean
  diffFound: boolean
  added: number
  removed: number
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
  return items
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

function toneForFolderStatus(
  status: FolderCompareItem['status'],
): 'default' | 'success' | 'warning' | 'danger' | 'accent' {
  if (status === 'same') return 'success'
  if (status === 'changed') return 'warning'
  if (status === 'left-only' || status === 'right-only') return 'accent'
  if (status === 'error' || status === 'type-mismatch') return 'danger'
  return 'default'
}

function formatFolderStatusLabel(status: FolderCompareItem['status']): string {
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

function canOpenFolderItem(entry: FolderCompareItem): boolean {
  return (
    entry.compareModeHint !== 'none' &&
    entry.leftExists &&
    entry.rightExists &&
    entry.leftKind === 'file' &&
    entry.rightKind === 'file'
  )
}

function getFolderItemActionReason(entry: FolderCompareItem): string | null {
  if (canOpenFolderItem(entry)) {
    return null
  }

  if (!entry.leftExists) return 'Only on right'
  if (!entry.rightExists) return 'Only on left'
  if (entry.leftKind !== entry.rightKind) return 'Type mismatch'
  if (entry.isDir) return 'Directory item'
  if (entry.leftKind === 'dir' || entry.rightKind === 'dir') return 'Directory item'
  if (entry.compareModeHint === 'none') return 'No compare mode'
  return 'Not comparable'
}

function folderQuickFilterLabel(filter: FolderQuickFilter): string {
  switch (filter) {
    case 'all':
      return 'All'
    case 'changed':
      return 'Changed'
    case 'left-only':
      return 'Left only'
    case 'right-only':
      return 'Right only'
    case 'type-mismatch':
      return 'Type mismatch'
    case 'error':
      return 'Errors'
    case 'same':
      return 'Same'
    default:
      return filter
  }
}

function filterFolderItemsByQuickFilter(
  items: FolderCompareItem[],
  quickFilter: FolderQuickFilter,
): FolderCompareItem[] {
  if (quickFilter === 'all') {
    return items
  }
  return items.filter((item) => item.status === quickFilter)
}

function toggleFolderSort(
  key: FolderSortKey,
  currentKey: FolderSortKey,
  currentDir: FolderSortDirection,
): { key: FolderSortKey; dir: FolderSortDirection } {
  if (key !== currentKey) {
    return { key, dir: 'asc' }
  }

  return { key, dir: currentDir === 'asc' ? 'desc' : 'asc' }
}

function ignorePathsToText(paths: string[]): string {
  return paths.join('\n')
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024*1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatFolderSide(exists: boolean, kind: string, size: number): string {
  if (!exists || kind === 'missing') {
    return '—'
  }
  if (kind === 'dir') {
    return 'dir'
  }
  if (kind === 'file') {
    return size > 0 ? `file · ${formatBytes(size)}` : 'file'
  }
  return kind
}

function folderStatusSortRank(status: FolderCompareItem['status']): number {
  switch (status) {
    case 'changed':
      return 0
    case 'left-only':
      return 1
    case 'right-only':
      return 2
    case 'type-mismatch':
      return 3
    case 'error':
      return 4
    case 'same':
      return 5
    default:
      return 99
  }
}

function sortFolderItemsForTree(items: FolderCompareItem[]): FolderCompareItem[] {
  return [...items].sort((left, right) => {
    if (left.isDir !== right.isDir) {
      return left.isDir ? -1 : 1
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

function folderItemsToTreeNodes(items: FolderCompareItem[]): FolderTreeNode[] {
  return sortFolderItemsForTree(items).map((item) => ({
    path: item.relativePath,
    name: item.name,
    isDir: item.isDir,
    status: item.status,
    item,
    children: item.isDir ? [] : undefined,
    loaded: !item.isDir,
    expanded: false,
  }))
}

function flattenFolderTreeRows(nodes: FolderTreeNode[], depth = 0): FolderTreeRow[] {
  const rows: FolderTreeRow[] = []
  for (const node of nodes) {
    rows.push({ depth, node })
    if (node.isDir && node.expanded && node.children && node.children.length > 0) {
      rows.push(...flattenFolderTreeRows(node.children, depth + 1))
    }
  }
  return rows
}

function treeNodeMatchesQuickFilter(
  node: FolderTreeNode,
  quickFilter: FolderQuickFilter,
): boolean {
  if (quickFilter === 'all') {
    return true
  }
  return node.status === quickFilter
}

function filterFolderTreeNodesByQuickFilter(
  nodes: FolderTreeNode[],
  quickFilter: FolderQuickFilter,
): FolderTreeNode[] {
  if (quickFilter === 'all') {
    return nodes
  }

  return nodes.flatMap((node) => {
    const filteredChildren = filterFolderTreeNodesByQuickFilter(node.children ?? [], quickFilter)
    const keepNode =
      treeNodeMatchesQuickFilter(node, quickFilter) || filteredChildren.length > 0

    if (!keepNode) {
      return []
    }

    return [
      {
        ...node,
        children: filteredChildren,
      },
    ]
  })
}

function buildFolderBreadcrumbs(currentPath: string): Array<{ label: string; path: string }> {
  const crumbs: Array<{ label: string; path: string }> = [{ label: 'Root', path: '' }]
  if (!currentPath) {
    return crumbs
  }

  const parts = currentPath.split('/').filter((part) => part.length > 0)
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part
    crumbs.push({ label: part, path: acc })
  }
  return crumbs
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

  const [jsonOldText, setJSONOldText] = useState('')
  const [jsonNewText, setJSONNewText] = useState('')
  const [jsonOldSourcePath, setJSONOldSourcePath] = useState('')
  const [jsonNewSourcePath, setJSONNewSourcePath] = useState('')
  const [ignoreOrder, setIgnoreOrder] = useState(false)
  const [jsonCommon, setJSONCommon] = useState<CompareCommon>(defaultJSONCommon)
  const [jsonResultView, setJSONResultView] = useState<JSONResultView>('rich')
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
  const [specResultView, setSpecResultView] = useState<'rich' | 'raw'>('rich')
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
  const [textPaneCopyBusyTarget, setTextPaneCopyBusyTarget] = useState<TextInputTarget | null>(
    null,
  )

  const textEditorBusy = textClipboardBusyTarget !== null || textFileBusyTarget !== null

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

  const jsonResult = jsonRichResult?.result ?? null
  const jsonDiffRows = jsonRichResult?.diffs ?? []
  const jsonDiffGroups = useMemo(() => buildJSONDiffGroups(jsonDiffRows), [jsonDiffRows])
  const canRenderJSONRich = !!jsonRichResult && !jsonRichResult.result.error
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
    if (!textResult) {
      return
    }

    if (textResultView === 'rich' && !canRenderTextRich) {
      setTextResultView('raw')
    }
  }, [canRenderTextRich, textResult, textResultView])

  useEffect(() => {
    if (!jsonRichResult) {
      return
    }

    if (jsonResultView === 'rich' && !canRenderJSONRich) {
      setJSONResultView('raw')
    }
  }, [canRenderJSONRich, jsonRichResult, jsonResultView])

  useEffect(() => {
    if (!specRichResult) {
      return
    }

    if (specResultView === 'rich' && !!specResult?.error) {
      setSpecResultView('raw')
    }
  }, [specRichResult, specResult?.error, specResultView])

  useEffect(() => {
    setJSONExpandedGroups(jsonDiffGroups.map((group) => group.key))
    setJSONExpandedValueKeys([])
  }, [jsonDiffGroups])

  useEffect(() => {
    setTextActiveSearchIndex(0)
  }, [normalizedTextSearchQuery, textResult?.output])

  useEffect(() => {
    setJSONActiveSearchIndex(0)
  }, [normalizedJSONSearchQuery, jsonRichResult?.result.output])

  useEffect(() => {
    setSpecActiveSearchIndex(0)
  }, [normalizedSpecSearchQuery, specRichResult?.result.output])

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
    if (jsonSearchMatches.length === 0) {
      if (jsonActiveSearchIndex !== 0) {
        setJSONActiveSearchIndex(0)
      }
      return
    }

    if (jsonActiveSearchIndex >= jsonSearchMatches.length) {
      setJSONActiveSearchIndex(0)
    }
  }, [jsonSearchMatches.length, jsonActiveSearchIndex])

  useEffect(() => {
    if (specSearchMatches.length === 0) {
      if (specActiveSearchIndex !== 0) {
        setSpecActiveSearchIndex(0)
      }
      return
    }

    if (specActiveSearchIndex >= specSearchMatches.length) {
      setSpecActiveSearchIndex(0)
    }
  }, [specSearchMatches.length, specActiveSearchIndex])

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

      setFolderCurrentPath('')
      setSelectedFolderItemPath('')
      setFolderResult(null)
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
        setJSONResultView('rich')
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
        setSpecResultView('rich')
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
      const message = `Failed to load folder children: ${formatUnknownError(error)}`
      setFolderStatus(message)
      notifications.show({
        title: 'Failed to load folder',
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
    setJSONResultView('rich')
    setJSONSearchQuery('')
    setJSONActiveSearchIndex(0)
    setResult(richRes.result)
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
    setSpecResultView('rich')
    setResult(richRes.result)
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
    const showHunkHeaders = shouldShowTextHunkHeaders(items)

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
          if (row.kind === 'hunk' && !showHunkHeaders) {
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
    const showHunkHeaders = shouldShowTextHunkHeaders(items)
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
        if (row.kind === 'hunk' && !showHunkHeaders) {
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
    const canSearchRich = showRich
    const diffCounts = summarizeTextDiffCounts(textRichRows)
    const textSummaryItems = buildTextSummaryBadgeItems({
      hasResult: hasTextResult,
      hasError: !!textResult?.error,
      diffFound: !!textResult?.diffFound,
      added: diffCounts.added,
      removed: diffCounts.removed,
    })
    const textSearchStatus = normalizedTextSearchQuery
      ? textSearchMatches.length > 0
        ? `${textActiveSearchIndex + 1} / ${textSearchMatches.length}`
        : '0 matches'
      : null

    return (
      <CompareResultShell
        hasResult={hasTextResult}
        toolbar={
          <CompareResultToolbar
          primary={
            <CompareSearchControls
              value={textSearchQuery}
              placeholder="Search rich diff"
              statusText={textSearchStatus}
              disabled={!canSearchRich}
              onChange={setTextSearchQuery}
              onPrev={() => moveTextSearch(-1)}
              onNext={() => moveTextSearch(1)}
              prevDisabled={!canSearchRich || textSearchMatches.length === 0}
              nextDisabled={!canSearchRich || textSearchMatches.length === 0}
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
          }
          summary={<CompareStatusBadges items={textSummaryItems} />}
          secondary={
            <>
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
              <ViewSettingsMenu
                tooltip="View settings"
                sections={[
                  {
                    title: 'Display',
                    items: [
                      {
                        key: 'text-display-rich',
                        label: 'Rich diff',
                        active: textResultView === 'rich',
                        disabled: !canRenderTextRich,
                        onSelect: () => setTextResultView('rich'),
                      },
                      {
                        key: 'text-display-raw',
                        label: 'Raw output',
                        active: textResultView === 'raw',
                        onSelect: () => setTextResultView('raw'),
                      },
                    ],
                  },
                  {
                    title: 'Layout',
                    items: [
                      {
                        key: 'text-layout-split',
                        label: 'Split',
                        active: textDiffLayout === 'split',
                        disabled: !canRenderTextRich,
                        onSelect: () => setTextDiffLayout('split'),
                      },
                      {
                        key: 'text-layout-unified',
                        label: 'Unified',
                        active: textDiffLayout === 'unified',
                        disabled: !canRenderTextRich,
                        onSelect: () => setTextDiffLayout('unified'),
                      },
                    ],
                  },
                  {
                    title: 'Sections',
                    items:
                      showRich && omittedSectionIds.length > 0
                        ? [
                            {
                              key: 'text-sections-toggle',
                              label: allOmittedSectionsExpanded
                                ? 'Collapse unchanged'
                                : 'Expand unchanged',
                              active: false,
                              onSelect: toggleAllTextUnchangedSections,
                            },
                          ]
                        : [],
                  },
                ]}
              />
            </>
          }
        />
        }
      >
        {showRich && textRichItems ? (
            textDiffLayout === 'split' ? (
              renderTextSplitRows(textRichItems)
            ) : (
              renderTextDiffRows(textRichItems)
            )
          ) : (
            <pre className="result-output">{raw}</pre>
          )}
      </CompareResultShell>
    )
  }

  const moveJSONSearch = (direction: 1 | -1) => {
    if (!canRenderJSONRich || jsonSearchMatches.length === 0) {
      return
    }

    if (jsonResultView !== 'rich') {
      setJSONResultView('rich')
    }

    setJSONActiveSearchIndex((prev) =>
      direction === 1
        ? (prev + 1) % jsonSearchMatches.length
        : (prev - 1 + jsonSearchMatches.length) % jsonSearchMatches.length,
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
    const showRich = jsonResultView === 'rich' && canRenderJSONRich
    const canSearchRich = showRich
    const activeJSONMatch = jsonSearchMatches[jsonActiveSearchIndex] ?? -1
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
      ? jsonSearchMatches.length > 0
        ? `${jsonActiveSearchIndex + 1} / ${jsonSearchMatches.length}`
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
              placeholder="Search paths or values"
              statusText={jsonSearchStatus}
              disabled={!canSearchRich}
              onChange={setJSONSearchQuery}
              onPrev={() => moveJSONSearch(-1)}
              onNext={() => moveJSONSearch(1)}
              prevDisabled={!canSearchRich || jsonSearchMatches.length === 0}
              nextDisabled={!canSearchRich || jsonSearchMatches.length === 0}
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
                        key: 'json-display-rich',
                        label: 'Rich diff',
                        active: jsonResultView === 'rich',
                        disabled: !canRenderJSONRich,
                        onSelect: () => setJSONResultView('rich'),
                      },
                      {
                        key: 'json-display-raw',
                        label: 'Raw output',
                        active: jsonResultView === 'raw',
                        onSelect: () => setJSONResultView('raw'),
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
        {showRich ? (
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
    const showRich = specResultView === 'rich' && !!specRichResult && !specResult?.error
    const canSearchRich = showRich
    const activeSpecMatch = specSearchMatches[specActiveSearchIndex] ?? -1
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
      ? specSearchMatches.length > 0
        ? `${specActiveSearchIndex + 1} / ${specSearchMatches.length}`
        : '0 matches'
      : null

    const moveSpecSearch = (direction: 1 | -1) => {
      if (!canSearchRich || specSearchMatches.length === 0) {
        return
      }
      if (specResultView !== 'rich') {
        setSpecResultView('rich')
      }
      setSpecActiveSearchIndex((prev) =>
        direction === 1
          ? (prev + 1) % specSearchMatches.length
          : (prev - 1 + specSearchMatches.length) % specSearchMatches.length,
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
                placeholder="Search paths or labels"
                statusText={specSearchStatus}
                disabled={!canSearchRich}
                onChange={setSpecSearchQuery}
                onPrev={() => moveSpecSearch(-1)}
                onNext={() => moveSpecSearch(1)}
                prevDisabled={!canSearchRich || specSearchMatches.length === 0}
                nextDisabled={!canSearchRich || specSearchMatches.length === 0}
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
                          key: 'spec-display-rich',
                          label: 'Rich diff',
                          active: specResultView === 'rich',
                          disabled: !specRichResult || !!specResult?.error,
                          onSelect: () => setSpecResultView('rich'),
                        },
                        {
                          key: 'spec-display-raw',
                          label: 'Raw output',
                          active: specResultView === 'raw',
                          onSelect: () => setSpecResultView('raw'),
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
        {showRich && specRichResult ? (
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
                <span className="folder-title">Folder Compare</span>
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
                  placeholder="Select left folder"
                  title={folderLeftRoot || 'Select left folder'}
                />
                <ActionIcon
                  variant="default"
                  size={24}
                  aria-label="Pick left folder"
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
                  placeholder="Select right folder"
                  title={folderRightRoot || 'Select right folder'}
                />
                <ActionIcon
                  variant="default"
                  size={24}
                  aria-label="Pick right folder"
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
                aria-label="Folder view mode"
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
                              {node.isDir ? (
                                <button
                                  type="button"
                                  className="folder-tree-chevron"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void toggleFolderTreeNode(node)
                                  }}
                                  aria-label={node.expanded ? 'Collapse folder' : 'Expand folder'}
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
                              {node.isDir ? (
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
              <pre className="result-output">(no folder result yet)</pre>
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
                <div>{selectedFolderItemForDetail.leftKind}</div>
                <div className="folder-detail-label">Right kind</div>
                <div>{selectedFolderItemForDetail.rightKind}</div>
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
                    Enter folder
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

  const compareModeHeaderActions = isCompareCentricMode ? (
    <CompareModeHeaderActions
      loading={loading}
      compareDisabled={
        mode === 'json' ? jsonCompareDisabled : mode === 'spec' ? specCompareDisabled : false
      }
      onCompare={() => void onRun()}
      optionsOpen={compareOptionsOpened}
      onToggleOptions={() => setCompareOptionsOpened((prev) => !prev)}
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
          Back to folder compare
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
