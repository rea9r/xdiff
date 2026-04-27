export type Mode = 'json' | 'text' | 'directory'

export type DiffCommon = {
  outputFormat: string
  textStyle: string
  ignorePaths: string[]
  ignoreWhitespace: boolean
  ignoreCase: boolean
  ignoreEOL: boolean
}

export type DiffResponse = {
  diffFound: boolean
  output: string
  error?: string
}

export type JSONRichDiffItem = {
  type: 'added' | 'removed' | 'changed' | 'type_changed'
  path: string
  oldValue?: unknown
  newValue?: unknown
}

export type JSONRichSummary = {
  added: number
  removed: number
  changed: number
  typeChanged: number
}

export type DiffJSONRichResponse = {
  result: DiffResponse
  diffText: string
  summary: JSONRichSummary
  diffs: JSONRichDiffItem[]
}

export type DiffJSONValuesRequest = {
  oldValue: string
  newValue: string
  common: DiffCommon
  ignoreOrder: boolean
}

export type TextEncoding =
  | 'utf-8'
  | 'shift-jis'
  | 'euc-jp'
  | 'utf-16-le'
  | 'utf-16-be'
  | 'iso-8859-1'

export type LoadTextFileRequest = {
  path: string
  encoding?: TextEncoding
}

export type LoadTextFileResponse = {
  path: string
  content: string
  encoding: TextEncoding
}

export type SaveTextFileRequest = {
  path: string
  content: string
  encoding?: TextEncoding
}

export type SaveTextFileResponse = {
  path: string
  encoding: TextEncoding
}

export type DiffDirectoriesRequest = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  recursive: boolean
  showSame: boolean
  nameFilter: string
}

export type DirectoryDiffSummary = {
  total: number
  same: number
  changed: number
  leftOnly: number
  rightOnly: number
  typeMismatch: number
  error: number
}

export type DirectoryDiffItem = {
  name: string
  relativePath: string
  isDir: boolean
  status: 'same' | 'changed' | 'left-only' | 'right-only' | 'type-mismatch' | 'error'
  leftPath: string
  rightPath: string
  leftExists: boolean
  rightExists: boolean
  leftKind: 'file' | 'dir' | 'missing' | 'unknown'
  rightKind: 'file' | 'dir' | 'missing' | 'unknown'
  leftSize: number
  rightSize: number
  diffModeHint: 'text' | 'json' | 'none'
  message?: string
}

export type DiffDirectoriesResponse = {
  currentPath: string
  parentPath?: string
  scannedSummary: DirectoryDiffSummary
  currentSummary: DirectoryDiffSummary
  items: DirectoryDiffItem[]
  error?: string
}

export type DesktopJSONSession = {
  oldSourcePath: string
  newSourcePath: string
  ignoreOrder: boolean
  common: DiffCommon
}

export type DesktopTextSession = {
  oldSourcePath: string
  newSourcePath: string
  common: DiffCommon
  diffLayout: 'split' | 'unified'
}

export type DesktopDirectorySession = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  viewMode: 'list' | 'tree'
}

export type DesktopRecentPair = {
  oldPath: string
  newPath: string
  usedAt: string
}

export type DesktopRecentDirectoryPair = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  viewMode: 'list' | 'tree'
  usedAt: string
}

export type DesktopTabSession = {
  id: string
  label: string
  lastUsedMode: Mode
  json: DesktopJSONSession
  text: DesktopTextSession
  directory: DesktopDirectorySession
}

export type ExplainDiffMode = 'text' | 'json' | 'directory'

export type DirectorySummaryItem = {
  relativePath: string
  status: string
  leftPath?: string
  rightPath?: string
  isDir: boolean
}

export type DirectorySummaryRequest = {
  items: DirectorySummaryItem[]
  totalBudget?: number
  perFileCap?: number
  maxFileSize?: number
}

export type DirectorySummarySkipped = {
  path: string
  reason: string
}

export type DirectorySummaryResponse = {
  context: string
  filesIncluded: string[]
  filesOmitted: string[]
  filesSkipped: DirectorySummarySkipped[]
  totalChanged: number
  totalLeftOnly: number
  totalRightOnly: number
  budgetUsed: number
  budgetTotal: number
}

export type ExplainDiffRequest = {
  diffText: string
  mode: ExplainDiffMode
  language?: string
  model?: string
}

export type ExplainDiffStreamRequest = {
  diffText: string
  mode: ExplainDiffMode
  language?: string
  model?: string
  streamId: string
}

export type ExplainDiffResponse = {
  explanation: string
  provider: string
  model: string
  error?: string
}

export type HardwareTier = 'low' | 'mid' | 'high'

export type AIProviderStatus = {
  available: boolean
  provider?: string
  baseUrl?: string
  models?: string[]
  error?: string
  ollamaInstalled: boolean
  ollamaReachable: boolean
  canAutoStart: boolean
  hardwareTier?: HardwareTier
}

export type AISetupRequest = {
  model?: string
}

export type DeleteOllamaModelRequest = {
  model: string
}

export type AISetupPhase =
  | 'idle'
  | 'starting'
  | 'waiting'
  | 'pulling'
  | 'ready'
  | 'error'

export type AISetupProgress = {
  phase: AISetupPhase
  message?: string
  error?: string
  model?: string
  pullCompleted?: number
  pullTotal?: number
  pullPercent?: number
}

export type DesktopState = {
  version: number
  tabs: DesktopTabSession[]
  activeTabId: string
  jsonRecentPairs: DesktopRecentPair[]
  textRecentPairs: DesktopRecentPair[]
  directoryRecentPairs: DesktopRecentDirectoryPair[]
}
