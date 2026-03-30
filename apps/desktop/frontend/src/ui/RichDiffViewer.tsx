import type { MutableRefObject, ReactNode } from 'react'
import {
  buildExpandedContextRow,
  buildTextSearchRowIDForItem,
  buildTextSearchRowIDForOmitted,
  shouldHideTextRichMetaRow,
  shouldShowTextHunkHeaders,
  type RichDiffItem,
  type UnifiedDiffRow,
} from '../features/text/textDiff'

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
  searchMatchIds?: Set<string>
  activeMatchId?: string | null
  registerSearchRowRef?: SearchRowRefRegistrar
  omittedSections?: OmittedSectionConfig
  splitHeaderLabels?: SplitHeaderLabels
}

const DEFAULT_SPLIT_HEADER_LABELS: SplitHeaderLabels = {
  left: 'Old',
  right: 'New',
}

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

function maybeRegisterSearchRowRef(
  registerSearchRowRef: SearchRowRefRegistrar | undefined,
  searchMatchIds: Set<string> | undefined,
  matchId: string,
): ((node: HTMLDivElement | null) => void) | undefined {
  if (!registerSearchRowRef || !searchMatchIds?.has(matchId)) {
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

function renderUnifiedRows(params: {
  items: RichDiffItem[]
  keyPrefix: string
  searchMatchIds?: Set<string>
  activeMatchId?: string | null
  registerSearchRowRef?: SearchRowRefRegistrar
  omittedSections?: OmittedSectionConfig
}) {
  const { items, keyPrefix, searchMatchIds, activeMatchId, registerSearchRowRef, omittedSections } =
    params
  const showHunkHeaders = shouldShowTextHunkHeaders(items)
  const isSectionExpanded = omittedSections?.isExpanded ?? (() => true)
  const renderSectionAction = omittedSections?.renderAction

  return (
    <div className="text-diff-grid">
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

                    return (
                      <div
                        key={`${keyPrefix}-${item.sectionId}-${index}`}
                        ref={maybeRegisterSearchRowRef(
                          registerSearchRowRef,
                          searchMatchIds,
                          matchId,
                        )}
                        className={['text-diff-row', row.kind, searchClassName]
                          .filter(Boolean)
                          .join(' ')}
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

        return (
          <div
            key={`${keyPrefix}-${idx}-${row.kind}`}
            ref={maybeRegisterSearchRowRef(registerSearchRowRef, searchMatchIds, matchId)}
            className={['text-diff-row', row.kind, searchClassName].filter(Boolean).join(' ')}
          >
            <div className="text-diff-line">{row.oldLine ?? ''}</div>
            <div className="text-diff-line">{row.newLine ?? ''}</div>
            <pre className="text-diff-content">
              {renderInlineDiffContent(row, `${keyPrefix}-diff-${idx}`)}
            </pre>
          </div>
        )
      })}
    </div>
  )
}

function renderSplitRows(params: {
  items: RichDiffItem[]
  keyPrefix: string
  searchMatchIds?: Set<string>
  activeMatchId?: string | null
  registerSearchRowRef?: SearchRowRefRegistrar
  omittedSections?: OmittedSectionConfig
  splitHeaderLabels?: SplitHeaderLabels
}) {
  const {
    items,
    keyPrefix,
    searchMatchIds,
    activeMatchId,
    registerSearchRowRef,
    omittedSections,
    splitHeaderLabels,
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

                return (
                  <div
                    key={`${keyPrefix}-split-omitted-row-${item.sectionId}-${lineIndex}`}
                    className="split-diff-row"
                  >
                    {renderSplitDiffCell(
                      row,
                      'left',
                      `${keyPrefix}-split-omitted-left-${item.sectionId}-${lineIndex}`,
                      searchClassName,
                      maybeRegisterSearchRowRef(registerSearchRowRef, searchMatchIds, matchId),
                    )}
                    {renderSplitDiffCell(
                      row,
                      'right',
                      `${keyPrefix}-split-omitted-right-${item.sectionId}-${lineIndex}`,
                      searchClassName,
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

      splitNodes.push(
        <div key={`${keyPrefix}-split-row-${index}`} className="split-diff-row">
          {renderSplitDiffCell(
            row,
            'left',
            `${keyPrefix}-split-left-${index}`,
            searchClassName,
            maybeRegisterSearchRowRef(registerSearchRowRef, searchMatchIds, matchId),
          )}
          {renderSplitDiffCell(row, 'right', `${keyPrefix}-split-right-${index}`, searchClassName)}
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
      const leftClassName = left
        ? getSearchClassName(searchMatchIds, activeMatchId, left.matchId)
        : ''
      const rightClassName = right
        ? getSearchClassName(searchMatchIds, activeMatchId, right.matchId)
        : ''

      splitNodes.push(
        <div key={`${keyPrefix}-split-pair-${index}-${pairIndex}`} className="split-diff-row">
          {renderSplitDiffCell(
            left?.row ?? null,
            'left',
            `${keyPrefix}-split-pair-left-${index}-${pairIndex}`,
            leftClassName,
            left
              ? maybeRegisterSearchRowRef(registerSearchRowRef, searchMatchIds, left.matchId)
              : undefined,
          )}
          {renderSplitDiffCell(
            right?.row ?? null,
            'right',
            `${keyPrefix}-split-pair-right-${index}-${pairIndex}`,
            rightClassName,
            right
              ? maybeRegisterSearchRowRef(registerSearchRowRef, searchMatchIds, right.matchId)
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
  searchMatchIds,
  activeMatchId,
  registerSearchRowRef,
  omittedSections,
  splitHeaderLabels,
}: RichDiffViewerProps) {
  return layout === 'split'
    ? renderSplitRows({
        items,
        keyPrefix,
        searchMatchIds,
        activeMatchId,
        registerSearchRowRef,
        omittedSections,
        splitHeaderLabels,
      })
    : renderUnifiedRows({
        items,
        keyPrefix,
        searchMatchIds,
        activeMatchId,
        registerSearchRowRef,
        omittedSections,
      })
}
