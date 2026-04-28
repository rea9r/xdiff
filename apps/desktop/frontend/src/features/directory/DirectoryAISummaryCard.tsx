import { useCallback, useMemo } from 'react'
import { Text } from '@mantine/core'
import { useDesktopBridge } from '../../useDesktopBridge'
import type {
  DirectoryDiffItem,
  DirectorySummaryItem,
  DirectorySummaryResponse,
} from '../../types'
import {
  AIInlineSummary,
  type AIInlineSummaryPrepared,
} from '../ai/AIInlineSummary'

const SKIP_REASON_LABEL: Record<string, string> = {
  binary: 'binary',
  'too-large': 'too large',
  'type-mismatch': 'type mismatch',
  'directory-scan-error': 'scan error',
  'missing-path': 'missing path',
}

function describeSkipReason(reason: string): string {
  if (SKIP_REASON_LABEL[reason]) return SKIP_REASON_LABEL[reason]
  if (reason.startsWith('read-error')) return 'read error'
  return reason
}

function CoverageLine({ ctx }: { ctx: DirectorySummaryResponse }) {
  const parts: string[] = []
  parts.push(
    `Covers ${ctx.filesIncluded.length} of ${ctx.totalChanged} changed file${
      ctx.totalChanged === 1 ? '' : 's'
    }`,
  )
  const extras: string[] = []
  if (ctx.totalRightOnly > 0) extras.push(`${ctx.totalRightOnly} added listed`)
  if (ctx.totalLeftOnly > 0) extras.push(`${ctx.totalLeftOnly} removed listed`)
  if (ctx.filesOmitted.length > 0) extras.push(`${ctx.filesOmitted.length} omitted by budget`)
  if (ctx.filesSkipped.length > 0) {
    const grouped: Record<string, number> = {}
    for (const s of ctx.filesSkipped) {
      grouped[s.reason] = (grouped[s.reason] || 0) + 1
    }
    for (const [reason, n] of Object.entries(grouped)) {
      extras.push(`${n} skipped (${describeSkipReason(reason)})`)
    }
  }
  if (extras.length) parts.push(extras.join(', '))
  return (
    <Text size="xs" c="dimmed">
      {parts.join(' • ')}
    </Text>
  )
}

export type DirectoryAISummaryCardProps = {
  items: DirectoryDiffItem[]
  changedCount: number
}

export function DirectoryAISummaryCard({ items, changedCount }: DirectoryAISummaryCardProps) {
  const { buildDirectorySummaryContext } = useDesktopBridge()

  const summaryItems: DirectorySummaryItem[] = useMemo(
    () =>
      items
        .filter((i) => !i.isDir && i.status !== 'same')
        .map((i) => ({
          relativePath: i.relativePath,
          status: i.status,
          leftPath: i.leftPath,
          rightPath: i.rightPath,
          isDir: i.isDir,
        })),
    [items],
  )

  const changedFileCount = useMemo(
    () => summaryItems.filter((i) => i.status === 'changed').length,
    [summaryItems],
  )

  const cacheKey = useMemo(
    () =>
      items
        .filter((i) => !i.isDir && i.status !== 'same')
        .map(
          (i) =>
            `${i.relativePath}|${i.status}|${i.leftSize}|${i.rightSize}|${i.leftPath}|${i.rightPath}`,
        )
        .join(';'),
    [items],
  )

  const prepare = useCallback(async (): Promise<AIInlineSummaryPrepared> => {
    const ctx = await buildDirectorySummaryContext({ items: summaryItems })
    return { diffText: ctx.context, coverage: <CoverageLine ctx={ctx} /> }
  }, [buildDirectorySummaryContext, summaryItems])

  const buildingLabel =
    changedFileCount > 0
      ? `Reading ${changedFileCount} file diff${changedFileCount === 1 ? '' : 's'}…`
      : 'Reading file diffs…'

  return (
    <AIInlineSummary
      cacheKey={cacheKey}
      prepare={prepare}
      ctaLabel="Summarize this diff with local AI"
      ctaHint={changedCount > 0 ? `${changedCount} entries differ` : undefined}
      mode="directory"
      buildingLabel={buildingLabel}
    />
  )
}
