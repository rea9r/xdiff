export type Mode = 'json' | 'spec' | 'text' | 'scenario'

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
