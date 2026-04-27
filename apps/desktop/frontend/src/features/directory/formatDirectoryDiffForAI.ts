import type { DiffDirectoriesResponse, DirectoryDiffItem } from '../../types'

const STATUS_ORDER: DirectoryDiffItem['status'][] = [
  'changed',
  'left-only',
  'right-only',
  'type-mismatch',
  'error',
]

const STATUS_LABEL: Record<DirectoryDiffItem['status'], string> = {
  changed: 'changed',
  'left-only': 'left-only',
  'right-only': 'right-only',
  'type-mismatch': 'type-mismatch',
  error: 'error',
  same: 'same',
}

function describeKind(item: DirectoryDiffItem): string {
  if (item.isDir) return 'dir'
  if (item.leftKind === 'dir' || item.rightKind === 'dir') {
    return `${item.leftKind}→${item.rightKind}`
  }
  return 'file'
}

export function formatDirectoryDiffForAI(result: DiffDirectoriesResponse): string {
  const summary = result.scannedSummary
  const lines: string[] = []
  lines.push(
    `Directory diff summary (scanned ${summary.total} entries):`,
    `  changed=${summary.changed} left-only=${summary.leftOnly} right-only=${summary.rightOnly} type-mismatch=${summary.typeMismatch} error=${summary.error} same=${summary.same}`,
    '',
  )

  const interesting = result.items.filter((item) => item.status !== 'same')
  if (interesting.length === 0) {
    lines.push('No differences in scanned entries.')
    return lines.join('\n')
  }

  for (const status of STATUS_ORDER) {
    const group = interesting.filter((item) => item.status === status)
    if (group.length === 0) continue
    lines.push(`# ${STATUS_LABEL[status]} (${group.length})`)
    for (const item of group) {
      const kind = describeKind(item)
      const path = item.relativePath || item.name
      const message = item.message ? `  -- ${item.message}` : ''
      lines.push(`  [${kind}] ${path}${message}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}
