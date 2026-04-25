export type Mode = 'json' | 'text' | 'scenario' | 'folder'

export type CompareCommon = {
  failOn: string
  outputFormat: string
  textStyle: string
  ignorePaths: string[]
  showPaths: boolean
  onlyBreaking: boolean
  noColor: boolean
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
  breaking: boolean
}

export type JSONRichSummary = {
  added: number
  removed: number
  changed: number
  typeChanged: number
  breaking: number
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

export type LoadTextFileRequest = {
  path: string
}

export type LoadTextFileResponse = {
  path: string
  content: string
}

export type CompareFoldersRequest = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  recursive: boolean
  showSame: boolean
  nameFilter: string
}

export type FolderCompareSummary = {
  total: number
  same: number
  changed: number
  leftOnly: number
  rightOnly: number
  typeMismatch: number
  error: number
}

export type FolderCompareItem = {
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

export type CompareFoldersResponse = {
  currentPath: string
  parentPath?: string
  scannedSummary: FolderCompareSummary
  currentSummary: FolderCompareSummary
  items: FolderCompareItem[]
  error?: string
}

export type ScenarioSummary = {
  total: number
  ok: number
  diff: number
  error: number
  exitCode: number
}

export type ScenarioResult = {
  name: string
  kind: string
  status: string
  exitCode: number
  diffFound: boolean
  output?: string
  errorMessage?: string
}

export type ScenarioRunResponse = {
  exitCode: number
  summary?: ScenarioSummary
  results?: ScenarioResult[]
  output?: string
  error?: string
}

export type ScenarioCheckListEntry = {
  name: string
  kind: string
  old: string
  new: string
  summary: string
}

export type ScenarioListResponse = {
  exitCode: number
  checks?: ScenarioCheckListEntry[]
  output?: string
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

export type DesktopFolderSession = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  viewMode: 'list' | 'tree'
}

export type DesktopScenarioSession = {
  scenarioPath: string
  reportFormat: 'text' | 'json'
}

export type DesktopRecentPair = {
  oldPath: string
  newPath: string
  usedAt: string
}

export type DesktopRecentFolderPair = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  viewMode: 'list' | 'tree'
  usedAt: string
}

export type DesktopRecentScenarioPath = {
  path: string
  reportFormat: 'text' | 'json'
  usedAt: string
}

export type DesktopState = {
  version: number
  lastUsedMode: Mode
  json: DesktopJSONSession
  text: DesktopTextSession
  folder: DesktopFolderSession
  scenario: DesktopScenarioSession
  jsonRecentPairs: DesktopRecentPair[]
  textRecentPairs: DesktopRecentPair[]
  folderRecentPairs: DesktopRecentFolderPair[]
  scenarioRecentPaths: DesktopRecentScenarioPath[]
}
