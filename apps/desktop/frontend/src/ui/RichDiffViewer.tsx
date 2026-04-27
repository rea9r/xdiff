import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from 'react'
import { Tooltip } from '@mantine/core'
import { IconChevronsDown, IconChevronsUp } from '@tabler/icons-react'
import {
  buildExpandedContextRow,
  buildTextSearchRowIDForItem,
  buildTextSearchRowIDForOmitted,
  shouldHideTextRichMetaRow,
  shouldShowTextHunkHeaders,
  type RichDiffItem,
  type TextChangeBlock,
  type UnifiedDiffRow,
} from '../features/text/textDiff'

export type AdoptDirection = 'to-new' | 'to-old'

export type AdoptBlockHandler = (block: TextChangeBlock, direction: AdoptDirection) => void

type SearchRowRefRegistrar = (matchId: string) => (node: HTMLDivElement | null) => void

export type OmittedSectionExpansion = { top: number; bottom: number }

type OmittedSectionConfig = {
  getExpansion?: (sectionId: string) => OmittedSectionExpansion
  expansionStep?: number
  onExpandTop?: (sectionId: string) => void
  onExpandBottom?: (sectionId: string) => void
  onExpandAll?: (sectionId: string) => void
}

const DEFAULT_OMITTED_EXPANSION: OmittedSectionExpansion = { top: 0, bottom: 0 }
const DEFAULT_OMITTED_EXPANSION_STEP = 20

type SplitHeaderLabels = {
  left: string
  right: string
}

type RichDiffViewerProps = {
  items: RichDiffItem[]
  layout: 'split' | 'unified'
  keyPrefix: string
  wrap?: boolean
  searchMatchIds?: Set<string>
  activeMatchId?: string | null
  navMatchIds?: Set<string>
  activeNavMatchId?: string | null
  registerSearchRowRef?: SearchRowRefRegistrar
  omittedSections?: OmittedSectionConfig
  splitHeaderLabels?: SplitHeaderLabels
  initialVisibleItems?: number
  changeBlocks?: TextChangeBlock[]
  onAdoptBlock?: AdoptBlockHandler
}

const DEFAULT_SPLIT_HEADER_LABELS: SplitHeaderLabels = {
  left: 'Old',
  right: 'New',
}
const DEFAULT_INITIAL_VISIBLE_ITEMS = 400

export function createSearchRowRefRegistrar(
  rowRefs: MutableRefObject<Record<string, HTMLDivElement | null>>,
): SearchRowRefRegistrar {
  return (matchId: string) => (node: HTMLDivElement | null) => {
    if (node) {
      rowRefs.current[matchId] = node
      return
    }

    delete rowRefs.current[matchId]
  }
}

function getSearchClassName(
  searchMatchIds: Set<string> | undefined,
  activeMatchId: string | null | undefined,
  matchId: string,
): string {
  if (!searchMatchIds?.has(matchId)) {
    return ''
  }

  return activeMatchId === matchId ? 'active-search-hit' : 'search-hit'
}

function getNavClassName(
  navMatchIds: Set<string> | undefined,
  activeNavMatchId: string | null | undefined,
  matchId: string,
): string {
  if (!navMatchIds?.has(matchId) || activeNavMatchId !== matchId) {
    return ''
  }

  return 'active-diff-hit'
}

function combineRowClassNames(...names: string[]): string {
  return names.filter(Boolean).join(' ')
}

function renderAdoptFloatingButtons(
  block: TextChangeBlock,
  layout: 'split' | 'unified',
  onAdoptBlock: AdoptBlockHandler,
  keyBase: string,
) {
  const adoptLabel = (direction: AdoptDirection) =>
    direction === 'to-new' ? 'Copy Old to New' : 'Copy New to Old'

  return (
    <div key={`${keyBase}-adopt`} className={`text-diff-adopt-floating ${layout}`}>
      <Tooltip label={adoptLabel('to-old')} withArrow>
        <button
          type="button"
          className="text-diff-adopt-button"
          aria-label={adoptLabel('to-old')}
          onClick={() => onAdoptBlock(block, 'to-old')}
        >
          ←
        </button>
      </Tooltip>
      <Tooltip label={adoptLabel('to-new')} withArrow>
        <button
          type="button"
          className="text-diff-adopt-button"
          aria-label={adoptLabel('to-new')}
          onClick={() => onAdoptBlock(block, 'to-new')}
        >
          →
        </button>
      </Tooltip>
    </div>
  )
}

function maybeRegisterSearchRowRef(
  registerSearchRowRef: SearchRowRefRegistrar | undefined,
  searchMatchIds: Set<string> | undefined,
  navMatchIds: Set<string> | undefined,
  matchId: string,
): ((node: HTMLDivElement | null) => void) | undefined {
  if (!registerSearchRowRef) {
    return undefined
  }
  if (!searchMatchIds?.has(matchId) && !navMatchIds?.has(matchId)) {
    return undefined
  }

  return registerSearchRowRef(matchId)
}

type ResolvedOmittedExpansion = {
  expansion: OmittedSectionExpansion
  total: number
  hidden: number
  fullyExpanded: boolean
  step: number
  canExpandTop: boolean
  canExpandBottom: boolean
  hasGranularControls: boolean
}

function resolveOmittedExpansion(
  config: OmittedSectionConfig | undefined,
  sectionId: string,
  total: number,
): ResolvedOmittedExpansion {
  const step = config?.expansionStep ?? DEFAULT_OMITTED_EXPANSION_STEP
  if (!config?.getExpansion) {
    return {
      expansion: { top: total, bottom: 0 },
      total,
      hidden: 0,
      fullyExpanded: true,
      step,
      canExpandTop: false,
      canExpandBottom: false,
      hasGranularControls: false,
    }
  }
  const raw = config.getExpansion(sectionId) ?? DEFAULT_OMITTED_EXPANSION
  const top = Math.max(0, Math.min(total, raw.top))
  const bottom = Math.max(0, Math.min(total - top, raw.bottom))
  const hidden = Math.max(0, total - top - bottom)
  const fullyExpanded = hidden === 0
  return {
    expansion: { top, bottom },
    total,
    hidden,
    fullyExpanded,
    step,
    canExpandTop: !fullyExpanded && !!config.onExpandTop,
    canExpandBottom: !fullyExpanded && !!config.onExpandBottom,
    hasGranularControls: true,
  }
}

function renderOmittedBannerContent(
  sectionId: string,
  resolved: ResolvedOmittedExpansion,
  config: OmittedSectionConfig | undefined,
  hunkHeader: string | null,
) {
  const hunkNode = hunkHeader ? (
    <code className="text-omitted-hunk-header">{hunkHeader}</code>
  ) : null

  if (!resolved.hasGranularControls) {
    return (
      <span className="text-omitted-meta">
        {resolved.hidden} unchanged lines
        {hunkNode ? <> · {hunkNode}</> : null}
      </span>
    )
  }

  const aboveStep = Math.min(resolved.step, resolved.hidden)
  const belowStep = Math.min(resolved.step, resolved.hidden)

  return (
    <>
      <div className="text-omitted-actions left">
        {resolved.canExpandTop ? (
          <Tooltip label={`Show ${aboveStep} lines above`} withArrow>
            <button
              type="button"
              className="text-omitted-icon-button"
              aria-label={`Show ${aboveStep} lines above`}
              onClick={() => config?.onExpandTop?.(sectionId)}
            >
              <IconChevronsUp size={14} />
              <span className="text-omitted-icon-label">{aboveStep}</span>
            </button>
          </Tooltip>
        ) : null}
      </div>
      <span className="text-omitted-meta">
        {resolved.hidden} unchanged lines
        {hunkNode ? <> · {hunkNode}</> : null}
      </span>
      <div className="text-omitted-actions right">
        {config?.onExpandAll ? (
          <button
            type="button"
            className="text-omitted-action button-link"
            onClick={() => config.onExpandAll?.(sectionId)}
          >
            Show all
          </button>
        ) : null}
        {resolved.canExpandBottom ? (
          <Tooltip label={`Show ${belowStep} lines below`} withArrow>
            <button
              type="button"
              className="text-omitted-icon-button"
              aria-label={`Show ${belowStep} lines below`}
              onClick={() => config?.onExpandBottom?.(sectionId)}
            >
              <IconChevronsDown size={14} />
              <span className="text-omitted-icon-label">{belowStep}</span>
            </button>
          </Tooltip>
        ) : null}
      </div>
    </>
  )
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
  highlightClassName = '',
  rowRef?: (node: HTMLDivElement | null) => void,
) {
  const lineNumber = side === 'left' ? row?.oldLine : row?.newLine
  const kindClass = row?.kind ?? 'empty'

  return (
    <div
      ref={rowRef}
      className={combineRowClassNames('split-diff-cell', kindClass, highlightClassName)}
    >
      <div className="split-diff-line">{lineNumber ?? ''}</div>
      <pre className="split-diff-content">
        {row ? renderInlineDiffContent(row, keyBase) : ''}
      </pre>
    </div>
  )
}

function renderUnifiedRows(params: {
  items: RichDiffItem[]
  keyPrefix: string
  wrap: boolean
  searchMatchIds?: Set<string>
  activeMatchId?: string | null
  navMatchIds?: Set<string>
  activeNavMatchId?: string | null
  registerSearchRowRef?: SearchRowRefRegistrar
  omittedSections?: OmittedSectionConfig
  blocksByStart?: Map<number, TextChangeBlock>
  onAdoptBlock?: AdoptBlockHandler
}) {
  const {
    items,
    keyPrefix,
    wrap,
    searchMatchIds,
    activeMatchId,
    navMatchIds,
    activeNavMatchId,
    registerSearchRowRef,
    omittedSections,
    blocksByStart,
    onAdoptBlock,
  } = params
  const showHunkHeaders = shouldShowTextHunkHeaders(items)
  const gridClassName = `text-diff-grid${wrap ? '' : ' no-wrap'}`

  const mergedHunkByOmittedIdx = new Map<number, string>()
  const consumedHunkIdxs = new Set<number>()
  items.forEach((item, idx) => {
    if (item.kind !== 'omitted') return
    const resolved = resolveOmittedExpansion(omittedSections, item.sectionId, item.lines.length)
    if (!resolved.hasGranularControls || !showHunkHeaders) return
    const next = items[idx + 1]
    if (next?.kind !== 'row' || next.row.kind !== 'hunk') return
    if (resolved.fullyExpanded) {
      consumedHunkIdxs.add(idx + 1)
      return
    }
    if (resolved.expansion.bottom === 0) {
      mergedHunkByOmittedIdx.set(idx, next.row.content)
      consumedHunkIdxs.add(idx + 1)
    }
  })

  const renderUnifiedOmittedLine = (
    item: Extract<RichDiffItem, { kind: 'omitted' }>,
    index: number,
  ) => {
    const line = item.lines[index]
    const row = buildExpandedContextRow(
      line,
      item.startOldLine + index,
      item.startNewLine + index,
    )
    const matchId = buildTextSearchRowIDForOmitted(item.sectionId, index)
    const searchClassName = getSearchClassName(searchMatchIds, activeMatchId, matchId)
    const navClassName = getNavClassName(navMatchIds, activeNavMatchId, matchId)

    return (
      <div
        key={`${keyPrefix}-${item.sectionId}-${index}`}
        ref={maybeRegisterSearchRowRef(
          registerSearchRowRef,
          searchMatchIds,
          navMatchIds,
          matchId,
        )}
        className={combineRowClassNames(
          'text-diff-row',
          row.kind,
          searchClassName,
          navClassName,
        )}
      >
        <div className="text-diff-line">{row.oldLine ?? ''}</div>
        <div className="text-diff-line">{row.newLine ?? ''}</div>
        <pre className="text-diff-content">{row.content}</pre>
      </div>
    )
  }

  const renderUnifiedRow = (row: UnifiedDiffRow, itemIndex: number): ReactNode => {
    const matchId = buildTextSearchRowIDForItem(itemIndex)
    const searchClassName = getSearchClassName(searchMatchIds, activeMatchId, matchId)
    const navClassName = getNavClassName(navMatchIds, activeNavMatchId, matchId)

    return (
      <div
        key={`${keyPrefix}-${itemIndex}-${row.kind}`}
        ref={maybeRegisterSearchRowRef(
          registerSearchRowRef,
          searchMatchIds,
          navMatchIds,
          matchId,
        )}
        className={combineRowClassNames('text-diff-row', row.kind, searchClassName, navClassName)}
      >
        <div className="text-diff-line">{row.oldLine ?? ''}</div>
        <div className="text-diff-line">{row.newLine ?? ''}</div>
        <pre className="text-diff-content">
          {renderInlineDiffContent(row, `${keyPrefix}-diff-${itemIndex}`)}
        </pre>
      </div>
    )
  }

  const nodes: ReactNode[] = []
  let idx = 0
  while (idx < items.length) {
    if (consumedHunkIdxs.has(idx)) {
      idx++
      continue
    }
    const item = items[idx]
    if (item.kind === 'omitted') {
      const total = item.lines.length
      const resolved = resolveOmittedExpansion(omittedSections, item.sectionId, total)
      const mergedHunk = mergedHunkByOmittedIdx.get(idx) ?? null
      const { top, bottom } = resolved.expansion
      const topLines: ReactNode[] = []
      for (let i = 0; i < top; i++) {
        topLines.push(renderUnifiedOmittedLine(item, i))
      }
      const bottomLines: ReactNode[] = []
      for (let i = total - bottom; i < total; i++) {
        bottomLines.push(renderUnifiedOmittedLine(item, i))
      }

      if (resolved.hasGranularControls && resolved.fullyExpanded) {
        nodes.push(
          <div key={`${keyPrefix}-${item.sectionId}`} className="text-omitted-block">
            {topLines}
          </div>,
        )
        idx++
        continue
      }

      const bannerClass = `text-omitted-banner${
        resolved.hasGranularControls ? '' : ' expanded'
      }${mergedHunk ? ' with-hunk' : ''}`
      const banner = (
        <div key={`${keyPrefix}-${item.sectionId}-banner`} className={bannerClass}>
          {renderOmittedBannerContent(item.sectionId, resolved, omittedSections, mergedHunk)}
        </div>
      )

      if (!resolved.hasGranularControls) {
        nodes.push(
          <div key={`${keyPrefix}-${item.sectionId}`} className="text-omitted-block">
            {banner}
            {topLines}
          </div>,
        )
      } else {
        nodes.push(
          <div key={`${keyPrefix}-${item.sectionId}`} className="text-omitted-block">
            {topLines}
            {banner}
            {bottomLines}
          </div>,
        )
      }
      idx++
      continue
    }

    const row = item.row
    if (shouldHideTextRichMetaRow(row)) {
      idx++
      continue
    }
    if (row.kind === 'hunk' && !showHunkHeaders) {
      idx++
      continue
    }

    const adoptBlock = blocksByStart?.get(idx)
    if (adoptBlock && onAdoptBlock) {
      const blockNodes: ReactNode[] = []
      for (let i = idx; i < adoptBlock.endItemIndex; i++) {
        const blockItem = items[i]
        if (blockItem.kind !== 'row') continue
        const blockRow = blockItem.row
        if (shouldHideTextRichMetaRow(blockRow)) continue
        if (blockRow.kind === 'hunk' && !showHunkHeaders) continue
        blockNodes.push(renderUnifiedRow(blockRow, i))
      }
      nodes.push(
        <div
          key={`${keyPrefix}-change-${idx}`}
          className="text-diff-change-group"
        >
          {blockNodes}
          {renderAdoptFloatingButtons(adoptBlock, 'unified', onAdoptBlock, `${keyPrefix}-${idx}`)}
        </div>,
      )
      idx = adoptBlock.endItemIndex
      continue
    }

    nodes.push(renderUnifiedRow(row, idx))
    idx++
  }

  return <div className={gridClassName}>{nodes}</div>
}

function renderSplitRows(params: {
  items: RichDiffItem[]
  keyPrefix: string
  wrap: boolean
  searchMatchIds?: Set<string>
  activeMatchId?: string | null
  navMatchIds?: Set<string>
  activeNavMatchId?: string | null
  registerSearchRowRef?: SearchRowRefRegistrar
  omittedSections?: OmittedSectionConfig
  splitHeaderLabels?: SplitHeaderLabels
  blocksByStart?: Map<number, TextChangeBlock>
  onAdoptBlock?: AdoptBlockHandler
}) {
  const {
    items,
    keyPrefix,
    wrap,
    searchMatchIds,
    activeMatchId,
    navMatchIds,
    activeNavMatchId,
    registerSearchRowRef,
    omittedSections,
    splitHeaderLabels,
    blocksByStart,
    onAdoptBlock,
  } = params
  const showHunkHeaders = shouldShowTextHunkHeaders(items)
  const labels = splitHeaderLabels ?? DEFAULT_SPLIT_HEADER_LABELS
  const splitNodes: ReactNode[] = []
  let index = 0

  const renderSplitOmittedLine = (
    item: Extract<RichDiffItem, { kind: 'omitted' }>,
    lineIndex: number,
  ) => {
    const line = item.lines[lineIndex]
    const row = buildExpandedContextRow(
      line,
      item.startOldLine + lineIndex,
      item.startNewLine + lineIndex,
    )
    const matchId = buildTextSearchRowIDForOmitted(item.sectionId, lineIndex)
    const searchClassName = getSearchClassName(searchMatchIds, activeMatchId, matchId)
    const navClassName = getNavClassName(navMatchIds, activeNavMatchId, matchId)
    const highlightClassName = combineRowClassNames(searchClassName, navClassName)

    return (
      <div
        key={`${keyPrefix}-split-omitted-row-${item.sectionId}-${lineIndex}`}
        className="split-diff-row"
      >
        {renderSplitDiffCell(
          row,
          'left',
          `${keyPrefix}-split-omitted-left-${item.sectionId}-${lineIndex}`,
          highlightClassName,
          maybeRegisterSearchRowRef(
            registerSearchRowRef,
            searchMatchIds,
            navMatchIds,
            matchId,
          ),
        )}
        {renderSplitDiffCell(
          row,
          'right',
          `${keyPrefix}-split-omitted-right-${item.sectionId}-${lineIndex}`,
          highlightClassName,
        )}
      </div>
    )
  }

  while (index < items.length) {
    const item = items[index]

    if (item.kind === 'omitted') {
      const total = item.lines.length
      const resolved = resolveOmittedExpansion(omittedSections, item.sectionId, total)
      const next = items[index + 1]
      const nextIsHunk = next?.kind === 'row' && next.row.kind === 'hunk'
      let mergedHunk: string | null = null
      let consumeNextHunk = false
      if (resolved.hasGranularControls && showHunkHeaders && nextIsHunk) {
        if (resolved.fullyExpanded) {
          consumeNextHunk = true
        } else if (resolved.expansion.bottom === 0) {
          mergedHunk = next.row.content
          consumeNextHunk = true
        }
      }
      const { top, bottom } = resolved.expansion
      const topLines: ReactNode[] = []
      for (let i = 0; i < top; i++) {
        topLines.push(renderSplitOmittedLine(item, i))
      }
      const bottomLines: ReactNode[] = []
      for (let i = total - bottom; i < total; i++) {
        bottomLines.push(renderSplitOmittedLine(item, i))
      }

      if (resolved.hasGranularControls && resolved.fullyExpanded) {
        splitNodes.push(
          <div
            key={`${keyPrefix}-split-omitted-${item.sectionId}`}
            className="split-omitted-block"
          >
            {topLines}
          </div>,
        )
        index += consumeNextHunk ? 2 : 1
        continue
      }

      const splitBannerClass = `split-diff-banner omitted${
        resolved.hasGranularControls ? '' : ' expanded'
      }${mergedHunk ? ' with-hunk' : ''}`
      const banner = (
        <div
          key={`${keyPrefix}-split-omitted-banner-${item.sectionId}`}
          className={splitBannerClass}
        >
          <div className="split-omitted-banner-inner">
            {renderOmittedBannerContent(item.sectionId, resolved, omittedSections, mergedHunk)}
          </div>
        </div>
      )

      if (!resolved.hasGranularControls) {
        splitNodes.push(
          <div
            key={`${keyPrefix}-split-omitted-${item.sectionId}`}
            className="split-omitted-block"
          >
            {banner}
            {topLines}
          </div>,
        )
      } else {
        splitNodes.push(
          <div
            key={`${keyPrefix}-split-omitted-${item.sectionId}`}
            className="split-omitted-block"
          >
            {topLines}
            {banner}
            {bottomLines}
          </div>,
        )
      }
      index += consumeNextHunk ? 2 : 1
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
        <div key={`${keyPrefix}-split-banner-${index}`} className={`split-diff-banner ${row.kind}`}>
          <pre className="split-diff-banner-content">{row.content}</pre>
        </div>,
      )
      index++
      continue
    }

    if (row.kind === 'context') {
      const matchId = buildTextSearchRowIDForItem(index)
      const searchClassName = getSearchClassName(searchMatchIds, activeMatchId, matchId)
      const navClassName = getNavClassName(navMatchIds, activeNavMatchId, matchId)
      const highlightClassName = combineRowClassNames(searchClassName, navClassName)

      splitNodes.push(
        <div key={`${keyPrefix}-split-row-${index}`} className="split-diff-row">
          {renderSplitDiffCell(
            row,
            'left',
            `${keyPrefix}-split-left-${index}`,
            highlightClassName,
            maybeRegisterSearchRowRef(
              registerSearchRowRef,
              searchMatchIds,
              navMatchIds,
              matchId,
            ),
          )}
          {renderSplitDiffCell(row, 'right', `${keyPrefix}-split-right-${index}`, highlightClassName)}
        </div>,
      )
      index++
      continue
    }

    const adoptBlock = blocksByStart?.get(index)

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
    const pairNodes: ReactNode[] = []
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
      const left = removed[pairIndex] ?? null
      const right = added[pairIndex] ?? null
      const leftClassName = left
        ? combineRowClassNames(
            getSearchClassName(searchMatchIds, activeMatchId, left.matchId),
            getNavClassName(navMatchIds, activeNavMatchId, left.matchId),
          )
        : ''
      const rightClassName = right
        ? combineRowClassNames(
            getSearchClassName(searchMatchIds, activeMatchId, right.matchId),
            getNavClassName(navMatchIds, activeNavMatchId, right.matchId),
          )
        : ''

      pairNodes.push(
        <div key={`${keyPrefix}-split-pair-${index}-${pairIndex}`} className="split-diff-row">
          {renderSplitDiffCell(
            left?.row ?? null,
            'left',
            `${keyPrefix}-split-pair-left-${index}-${pairIndex}`,
            leftClassName,
            left
              ? maybeRegisterSearchRowRef(
                  registerSearchRowRef,
                  searchMatchIds,
                  navMatchIds,
                  left.matchId,
                )
              : undefined,
          )}
          {renderSplitDiffCell(
            right?.row ?? null,
            'right',
            `${keyPrefix}-split-pair-right-${index}-${pairIndex}`,
            rightClassName,
            right
              ? maybeRegisterSearchRowRef(
                  registerSearchRowRef,
                  searchMatchIds,
                  navMatchIds,
                  right.matchId,
                )
              : undefined,
          )}
        </div>,
      )
    }

    if (adoptBlock && onAdoptBlock && pairNodes.length > 0) {
      splitNodes.push(
        <div
          key={`${keyPrefix}-split-change-${index}`}
          className="split-diff-change-group"
        >
          {pairNodes}
          {renderAdoptFloatingButtons(adoptBlock, 'split', onAdoptBlock, `${keyPrefix}-split-${index}`)}
        </div>,
      )
    } else {
      for (const node of pairNodes) {
        splitNodes.push(node)
      }
    }

    index = end
  }

  const gridClassName = `split-diff-grid${wrap ? '' : ' no-wrap'}`

  return (
    <div className={gridClassName}>
      <div className="split-diff-header">
        <div className="split-diff-header-cell">{labels.left}</div>
        <div className="split-diff-header-cell">{labels.right}</div>
      </div>
      {splitNodes}
    </div>
  )
}

export function RichDiffViewer({
  items,
  layout,
  keyPrefix,
  wrap = true,
  searchMatchIds,
  activeMatchId,
  navMatchIds,
  activeNavMatchId,
  registerSearchRowRef,
  omittedSections,
  splitHeaderLabels,
  initialVisibleItems = DEFAULT_INITIAL_VISIBLE_ITEMS,
  changeBlocks,
  onAdoptBlock,
}: RichDiffViewerProps) {
  const [visibleItemsCount, setVisibleItemsCount] = useState(() => initialVisibleItems)

  useEffect(() => {
    setVisibleItemsCount(initialVisibleItems)
  }, [initialVisibleItems, items.length, keyPrefix, layout])

  const shouldRenderAllItems =
    (searchMatchIds?.size ?? 0) > 0 || (navMatchIds?.size ?? 0) > 0
  const renderedItems = useMemo(() => {
    if (shouldRenderAllItems) {
      return items
    }
    return items.slice(0, visibleItemsCount)
  }, [items, shouldRenderAllItems, visibleItemsCount])
  const hasMoreItems = !shouldRenderAllItems && renderedItems.length < items.length
  const blocksByStart = useMemo(() => {
    if (!changeBlocks || changeBlocks.length === 0) {
      return undefined
    }
    const map = new Map<number, TextChangeBlock>()
    for (const block of changeBlocks) {
      map.set(block.startItemIndex, block)
    }
    return map
  }, [changeBlocks])

  return layout === 'split'
    ? (
        <>
          {renderSplitRows({
            items: renderedItems,
            keyPrefix,
            wrap,
            searchMatchIds,
            activeMatchId,
            navMatchIds,
            activeNavMatchId,
            registerSearchRowRef,
            omittedSections,
            splitHeaderLabels,
            blocksByStart,
            onAdoptBlock,
          })}
          {hasMoreItems ? (
            <div className="result-load-more">
              <button
                type="button"
                className="button-secondary button-compact"
                onClick={() => setVisibleItemsCount((prev) => prev + initialVisibleItems)}
              >
                Show more ({items.length - renderedItems.length} remaining)
              </button>
            </div>
          ) : null}
        </>
      )
    : (
        <>
          {renderUnifiedRows({
            items: renderedItems,
            keyPrefix,
            wrap,
            searchMatchIds,
            activeMatchId,
            navMatchIds,
            activeNavMatchId,
            registerSearchRowRef,
            omittedSections,
            blocksByStart,
            onAdoptBlock,
          })}
          {hasMoreItems ? (
            <div className="result-load-more">
              <button
                type="button"
                className="button-secondary button-compact"
                onClick={() => setVisibleItemsCount((prev) => prev + initialVisibleItems)}
              >
                Show more ({items.length - renderedItems.length} remaining)
              </button>
            </div>
          ) : null}
        </>
      )
}
