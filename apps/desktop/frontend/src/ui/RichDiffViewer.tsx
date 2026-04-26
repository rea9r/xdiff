import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from 'react'
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

type OmittedSectionConfig = {
  isExpanded?: (sectionId: string) => boolean
  renderAction?: (sectionId: string, expanded: boolean) => ReactNode
}

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

function renderAdoptActionBar(
  block: TextChangeBlock,
  layout: 'split' | 'unified',
  onAdoptBlock: AdoptBlockHandler,
  keyBase: string,
) {
  const adoptLabel = (direction: AdoptDirection) =>
    direction === 'to-new'
      ? 'Apply Old → New (overwrite New with Old here)'
      : 'Apply New → Old (overwrite Old with New here)'

  return (
    <div key={`${keyBase}-adopt`} className={`text-diff-adopt-bar ${layout}`}>
      <button
        type="button"
        className="text-diff-adopt-button"
        title={adoptLabel('to-old')}
        aria-label={adoptLabel('to-old')}
        onClick={() => onAdoptBlock(block, 'to-old')}
      >
        ←
      </button>
      <button
        type="button"
        className="text-diff-adopt-button"
        title={adoptLabel('to-new')}
        aria-label={adoptLabel('to-new')}
        onClick={() => onAdoptBlock(block, 'to-new')}
      >
        →
      </button>
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
  const isSectionExpanded = omittedSections?.isExpanded ?? (() => true)
  const renderSectionAction = omittedSections?.renderAction
  const gridClassName = `text-diff-grid${wrap ? '' : ' no-wrap'}`

  return (
    <div className={gridClassName}>
      {items.map((item, idx) => {
        if (item.kind === 'omitted') {
          const expanded = isSectionExpanded(item.sectionId)

          return (
            <div key={`${keyPrefix}-${item.sectionId}`} className="text-omitted-block">
              <div className={`text-omitted-banner ${expanded ? 'expanded' : ''}`}>
                <span className="muted">{item.lines.length} unchanged lines</span>
                {renderSectionAction ? renderSectionAction(item.sectionId, expanded) : null}
              </div>

              {expanded
                ? item.lines.map((line, index) => {
                    const row = buildExpandedContextRow(
                      line,
                      item.startOldLine + index,
                      item.startNewLine + index,
                    )
                    const matchId = buildTextSearchRowIDForOmitted(item.sectionId, index)
                    const searchClassName = getSearchClassName(
                      searchMatchIds,
                      activeMatchId,
                      matchId,
                    )
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
                  })
                : null}
            </div>
          )
        }

        const row = item.row
        if (shouldHideTextRichMetaRow(row)) {
          return null
        }
        if (row.kind === 'hunk' && !showHunkHeaders) {
          return null
        }

        const matchId = buildTextSearchRowIDForItem(idx)
        const searchClassName = getSearchClassName(searchMatchIds, activeMatchId, matchId)
        const navClassName = getNavClassName(navMatchIds, activeNavMatchId, matchId)
        const adoptBlock = blocksByStart?.get(idx)

        const rowNode = (
          <div
            key={`${keyPrefix}-${idx}-${row.kind}`}
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
              {renderInlineDiffContent(row, `${keyPrefix}-diff-${idx}`)}
            </pre>
          </div>
        )

        if (adoptBlock && onAdoptBlock) {
          return [
            renderAdoptActionBar(
              adoptBlock,
              'unified',
              onAdoptBlock,
              `${keyPrefix}-${idx}`,
            ),
            rowNode,
          ]
        }

        return rowNode
      })}
    </div>
  )
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
  const isSectionExpanded = omittedSections?.isExpanded ?? (() => true)
  const renderSectionAction = omittedSections?.renderAction
  const splitNodes: ReactNode[] = []
  let index = 0

  while (index < items.length) {
    const item = items[index]

    if (item.kind === 'omitted') {
      const expanded = isSectionExpanded(item.sectionId)

      splitNodes.push(
        <div key={`${keyPrefix}-split-omitted-${item.sectionId}`} className="split-omitted-block">
          <div className="split-diff-banner omitted">
            <div className="split-omitted-banner-inner">
              <span className="muted">{item.lines.length} unchanged lines</span>
              {renderSectionAction ? renderSectionAction(item.sectionId, expanded) : null}
            </div>
          </div>

          {expanded
            ? item.lines.map((line, lineIndex) => {
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
              })
            : null}
        </div>,
      )
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
    if (adoptBlock && onAdoptBlock) {
      splitNodes.push(
        renderAdoptActionBar(adoptBlock, 'split', onAdoptBlock, `${keyPrefix}-split-${index}`),
      )
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

      splitNodes.push(
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
