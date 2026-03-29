type WailsRuntimeClipboard = {
  ClipboardGetText?: () => Promise<string>
  ClipboardSetText?: (text: string) => Promise<boolean>
}

export function renderResult(res: unknown): string {
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

export function summarizeResponse(res: unknown): string {
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

export function ignorePathsToText(paths: string[]): string {
  return paths.join('\n')
}

export function parseIgnorePaths(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function getRuntimeClipboardRead(): (() => Promise<string>) | null {
  const runtimeClipboard = (window as Window & {
    runtime?: WailsRuntimeClipboard
  }).runtime

  return runtimeClipboard?.ClipboardGetText ?? null
}

export function getRuntimeClipboardWrite(): ((text: string) => Promise<boolean>) | null {
  const runtimeClipboard = (window as Window & {
    runtime?: WailsRuntimeClipboard
  }).runtime

  return runtimeClipboard?.ClipboardSetText ?? null
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return String(error)
}
