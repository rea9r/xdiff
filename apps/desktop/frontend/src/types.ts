export type Mode = 'json' | 'text' | 'directory'

export type CompareCommon = {
  outputFormat: string
  textStyle: string
  ignorePaths: string[]
  ignoreWhitespace: boolean
  ignoreCase: boolean
  ignoreEOL: boolean
}

export type CompareResponse = {
  exitCode: number
  diffFound: boolean
  output: string
  error?: string
  paths?: string[]
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

export type CompareJSONRichResponse = {
  result: CompareResponse
  diffText: string
  summary: JSONRichSummary
  diffs: JSONRichDiffItem[]
}

export type CompareJSONValuesRequest = {
  oldValue: string
  newValue: string
  common: CompareCommon
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

export type CompareDirectoriesRequest = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  recursive: boolean
  showSame: boolean
  nameFilter: string
}

export type DirectoryCompareSummary = {
  total: number
  same: number
  changed: number
  leftOnly: number
  rightOnly: number
  typeMismatch: number
  error: number
}

export type DirectoryCompareItem = {
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
  compareModeHint: 'text' | 'json' | 'none'
  message?: string
}

export type CompareDirectoriesResponse = {
  currentPath: string
  parentPath?: string
  scannedSummary: DirectoryCompareSummary
  currentSummary: DirectoryCompareSummary
  items: DirectoryCompareItem[]
  error?: string
}

export type DesktopJSONSession = {
  oldSourcePath: string
  newSourcePath: string
  ignoreOrder: boolean
  common: CompareCommon
}

export type DesktopTextSession = {
  oldSourcePath: string
  newSourcePath: string
  common: CompareCommon
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

export type ExplainDiffRequest = {
  diffText: string
  mode: ExplainDiffMode
  language?: string
  model?: string
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
