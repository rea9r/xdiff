import type { ReactNode } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { IconCopy } from '@tabler/icons-react'
import type { CompareResponse } from '../../types'
import { renderResult } from '../../utils/appHelpers'
import { CompareResultToolbar } from '../../ui/CompareResultToolbar'
import { CompareSearchControls } from '../../ui/CompareSearchControls'
import {
  CompareStatusBadges,
  type CompareStatusBadgeItem,
} from '../../ui/CompareStatusBadges'
import { ViewSettingsMenu } from '../../ui/ViewSettingsMenu'
import { CompareResultShell } from '../../ui/CompareResultShell'
import {
  buildExpandedContextRow,
  buildTextSearchRowIDForItem,
  buildTextSearchRowIDForOmitted,
  shouldHideTextRichMetaRow,
  shouldShowTextHunkHeaders,
  summarizeTextDiffCounts,
  type OmittedDiffItem,
  type RichDiffItem,
  type TextSearchMatch,
  type UnifiedDiffRow,
} from './textDiff'
import type { TextDiffLayout, TextResultView } from './useTextDiffViewState'

type TextCompareResultPanelProps = {
  textResult: CompareResponse | null
  textResultView: TextResultView
  setTextResultView: (value: TextResultView) => void
  textDiffLayout: TextDiffLayout
  setTextDiffLayout: (value: TextDiffLayout) => void
  textSearchQuery: string
  setTextSearchQuery: (value: string) => void
  textActiveSearchIndex: number
  normalizedTextSearchQuery: string
  textSearchMatches: TextSearchMatch[]
  textRichRows: UnifiedDiffRow[] | null
  textRichItems: RichDiffItem[] | null
  omittedSectionIds: string[]
  allOmittedSectionsExpanded: boolean
  canRenderTextRich: boolean
  textCopyBusy: boolean
  copyTextResultRawOutput: () => void | Promise<void>
  moveTextSearch: (direction: 1 | -1) => void
  toggleTextUnchangedSection: (sectionId: string) => void
  toggleAllTextUnchangedSections: () => void
  isTextSectionExpanded: (sectionId: string) => boolean
  isTextSearchMatchId: (matchId: string) => boolean
  registerTextSearchRowRef: (matchId: string) => (node: HTMLDivElement | null) => void
  getTextSearchClassName: (matchId: string) => string
  renderInlineDiffContent: (row: UnifiedDiffRow, keyBase: string) => ReactNode
  renderSplitDiffCell: (
    row: UnifiedDiffRow | null,
    side: 'left' | 'right',
    keyBase: string,
    searchClassName?: string,
    rowRef?: (node: HTMLDivElement | null) => void,
  ) => ReactNode
}

function buildTextSummaryBadgeItems(params: {
  hasResult: boolean
  hasError: boolean
  diffFound: boolean
  added: number
  removed: number
}): CompareStatusBadgeItem[] {
  if (!params.hasResult) {
    return []
  }

  if (params.hasError) {
    return [{ key: 'error', label: 'Execution error', tone: 'error' }]
  }

  if (!params.diffFound) {
    return [{ key: 'none', label: 'No differences', tone: 'neutral' }]
  }

  const items: CompareStatusBadgeItem[] = []
  if (params.added > 0) {
    items.push({ key: 'added', label: `+${params.added}`, tone: 'added' })
  }
  if (params.removed > 0) {
    items.push({ key: 'removed', label: `-${params.removed}`, tone: 'removed' })
  }
  return items
}

export function TextCompareResultPanel({
  textResult,
  textResultView,
  setTextResultView,
  textDiffLayout,
  setTextDiffLayout,
  textSearchQuery,
  setTextSearchQuery,
  textActiveSearchIndex,
  normalizedTextSearchQuery,
  textSearchMatches,
  textRichRows,
  textRichItems,
  omittedSectionIds,
  allOmittedSectionsExpanded,
  canRenderTextRich,
  textCopyBusy,
  copyTextResultRawOutput,
  moveTextSearch,
  toggleTextUnchangedSection,
  toggleAllTextUnchangedSections,
  isTextSectionExpanded,
  isTextSearchMatchId,
  registerTextSearchRowRef,
  getTextSearchClassName,
  renderInlineDiffContent,
  renderSplitDiffCell,
}: TextCompareResultPanelProps) {
  const renderUnifiedOmittedBlock = (item: OmittedDiffItem) => {
    const expanded = isTextSectionExpanded(item.sectionId)

    return (
      <div key={item.sectionId} className="text-omitted-block">
        <div className={`text-omitted-banner ${expanded ? 'expanded' : ''}`}>
          <span className="muted">{item.lines.length} unchanged lines</span>
          <button
            type="button"
            className="text-omitted-action button-secondary button-compact"
            onClick={() => toggleTextUnchangedSection(item.sectionId)}
          >
            {expanded ? 'Collapse unchanged' : 'Show hidden lines'}
          </button>
        </div>

        {expanded
          ? item.lines.map((line, index) => {
              const row = buildExpandedContextRow(
                line,
                item.startOldLine + index,
                item.startNewLine + index,
              )
              const matchId = buildTextSearchRowIDForOmitted(item.sectionId, index)
              const searchClassName = getTextSearchClassName(matchId)

              return (
                <div
                  key={`${item.sectionId}-${index}`}
                  ref={isTextSearchMatchId(matchId) ? registerTextSearchRowRef(matchId) : undefined}
                  className={['text-diff-row', row.kind, searchClassName].filter(Boolean).join(' ')}
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

  const renderSplitOmittedBlock = (item: OmittedDiffItem) => {
    const expanded = isTextSectionExpanded(item.sectionId)

    return (
      <div key={item.sectionId} className="split-omitted-block">
        <div className="split-diff-banner omitted">
          <div className="split-omitted-banner-inner">
            <span className="muted">{item.lines.length} unchanged lines</span>
            <button
              type="button"
              className="text-omitted-action button-secondary button-compact"
              onClick={() => toggleTextUnchangedSection(item.sectionId)}
            >
              {expanded ? 'Collapse unchanged' : 'Show hidden lines'}
            </button>
          </div>
        </div>

        {expanded
          ? item.lines.map((line, index) => {
              const row = buildExpandedContextRow(
                line,
                item.startOldLine + index,
                item.startNewLine + index,
              )
              const matchId = buildTextSearchRowIDForOmitted(item.sectionId, index)
              const searchClassName = getTextSearchClassName(matchId)

              return (
                <div key={`${item.sectionId}-${index}`} className="split-diff-row">
                  {renderSplitDiffCell(
                    row,
                    'left',
                    `split-omitted-left-${item.sectionId}-${index}`,
                    searchClassName,
                    isTextSearchMatchId(matchId) ? registerTextSearchRowRef(matchId) : undefined,
                  )}
                  {renderSplitDiffCell(
                    row,
                    'right',
                    `split-omitted-right-${item.sectionId}-${index}`,
                    searchClassName,
                  )}
                </div>
              )
            })
          : null}
      </div>
    )
  }

  const renderTextDiffRows = (items: RichDiffItem[]) => {
    const showHunkHeaders = shouldShowTextHunkHeaders(items)

    return (
      <div className="text-diff-grid">
        {items.map((item, idx) => {
          if (item.kind === 'omitted') {
            return renderUnifiedOmittedBlock(item)
          }

          const row = item.row
          if (shouldHideTextRichMetaRow(row)) {
            return null
          }
          if (row.kind === 'hunk' && !showHunkHeaders) {
            return null
          }

          const matchId = buildTextSearchRowIDForItem(idx)
          const searchClassName = getTextSearchClassName(matchId)
          return (
            <div
              key={`${idx}-${row.kind}`}
              ref={isTextSearchMatchId(matchId) ? registerTextSearchRowRef(matchId) : undefined}
              className={['text-diff-row', row.kind, searchClassName].filter(Boolean).join(' ')}
            >
              <div className="text-diff-line">{row.oldLine ?? ''}</div>
              <div className="text-diff-line">{row.newLine ?? ''}</div>
              <pre className="text-diff-content">
                {renderInlineDiffContent(row, `text-diff-${idx}`)}
              </pre>
            </div>
          )
        })}
      </div>
    )
  }

  const renderTextSplitRows = (items: RichDiffItem[]) => {
    const showHunkHeaders = shouldShowTextHunkHeaders(items)
    const splitNodes: ReactNode[] = []
    let index = 0

    while (index < items.length) {
      const item = items[index]

      if (item.kind === 'omitted') {
        splitNodes.push(renderSplitOmittedBlock(item))
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
          <div key={`split-banner-${index}`} className={`split-diff-banner ${row.kind}`}>
            <pre className="split-diff-banner-content">{row.content}</pre>
          </div>,
        )
        index++
        continue
      }

      if (row.kind === 'context') {
        const matchId = buildTextSearchRowIDForItem(index)
        const searchClassName = getTextSearchClassName(matchId)

        splitNodes.push(
          <div key={`split-row-${index}`} className="split-diff-row">
            {renderSplitDiffCell(
              row,
              'left',
              `split-left-${index}`,
              searchClassName,
              isTextSearchMatchId(matchId) ? registerTextSearchRowRef(matchId) : undefined,
            )}
            {renderSplitDiffCell(row, 'right', `split-right-${index}`, searchClassName)}
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

        splitNodes.push(
          <div key={`split-pair-${index}-${pairIndex}`} className="split-diff-row">
            {renderSplitDiffCell(
              left?.row ?? null,
              'left',
              `split-left-${index}-${pairIndex}`,
              left ? getTextSearchClassName(left.matchId) : '',
              left && isTextSearchMatchId(left.matchId)
                ? registerTextSearchRowRef(left.matchId)
                : undefined,
            )}
            {renderSplitDiffCell(
              right?.row ?? null,
              'right',
              `split-right-${index}-${pairIndex}`,
              right ? getTextSearchClassName(right.matchId) : '',
              right && isTextSearchMatchId(right.matchId)
                ? registerTextSearchRowRef(right.matchId)
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
          <div className="split-diff-header-cell">Old</div>
          <div className="split-diff-header-cell">New</div>
        </div>
        {splitNodes}
      </div>
    )
  }

  const raw = textResult ? renderResult(textResult) : ''
  const hasTextResult = !!textResult
  const showRich = textResultView === 'diff' && canRenderTextRich && !!textRichItems
  const canSearchRich = showRich
  const diffCounts = summarizeTextDiffCounts(textRichRows)
  const textSummaryItems = buildTextSummaryBadgeItems({
    hasResult: hasTextResult,
    hasError: !!textResult?.error,
    diffFound: !!textResult?.diffFound,
    added: diffCounts.added,
    removed: diffCounts.removed,
  })
  const textSearchStatus = normalizedTextSearchQuery
    ? textSearchMatches.length > 0
      ? `${textActiveSearchIndex + 1} / ${textSearchMatches.length}`
      : '0 matches'
    : null

  return (
    <CompareResultShell
      hasResult={hasTextResult}
      toolbar={
        <CompareResultToolbar
          primary={
            <CompareSearchControls
              value={textSearchQuery}
              placeholder="Search diff"
              statusText={textSearchStatus}
              disabled={!canSearchRich}
              onChange={setTextSearchQuery}
              onPrev={() => moveTextSearch(-1)}
              onNext={() => moveTextSearch(1)}
              prevDisabled={!canSearchRich || textSearchMatches.length === 0}
              nextDisabled={!canSearchRich || textSearchMatches.length === 0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  moveTextSearch(e.shiftKey ? -1 : 1)
                  return
                }

                if (e.key === 'Escape') {
                  setTextSearchQuery('')
                }
              }}
            />
          }
          summary={<CompareStatusBadges items={textSummaryItems} />}
          secondary={
            <>
              <Tooltip label="Copy raw output">
                <ActionIcon
                  variant="default"
                  size={28}
                  aria-label="Copy raw output"
                  className="text-result-action"
                  onClick={() => void copyTextResultRawOutput()}
                  disabled={textCopyBusy || !raw}
                  loading={textCopyBusy}
                >
                  <IconCopy size={15} />
                </ActionIcon>
              </Tooltip>
              <ViewSettingsMenu
                tooltip="View settings"
                sections={[
                  {
                    title: 'Display',
                    items: [
                      {
                        key: 'text-display-diff',
                        label: 'Diff',
                        active: textResultView === 'diff',
                        disabled: !canRenderTextRich,
                        onSelect: () => setTextResultView('diff'),
                      },
                      {
                        key: 'text-display-raw',
                        label: 'Raw',
                        active: textResultView === 'raw',
                        onSelect: () => setTextResultView('raw'),
                      },
                    ],
                  },
                  {
                    title: 'Layout',
                    items: [
                      {
                        key: 'text-layout-split',
                        label: 'Split',
                        active: textDiffLayout === 'split',
                        disabled: textResultView !== 'diff' || !canRenderTextRich,
                        onSelect: () => setTextDiffLayout('split'),
                      },
                      {
                        key: 'text-layout-unified',
                        label: 'Unified',
                        active: textDiffLayout === 'unified',
                        disabled: textResultView !== 'diff' || !canRenderTextRich,
                        onSelect: () => setTextDiffLayout('unified'),
                      },
                    ],
                  },
                  {
                    title: 'Sections',
                    items:
                      showRich && omittedSectionIds.length > 0
                        ? [
                            {
                              key: 'text-sections-toggle',
                              label: allOmittedSectionsExpanded
                                ? 'Collapse unchanged'
                                : 'Expand unchanged',
                              active: false,
                              onSelect: toggleAllTextUnchangedSections,
                            },
                          ]
                        : [],
                  },
                ]}
              />
            </>
          }
        />
      }
    >
      {showRich && textRichItems ? (
        textDiffLayout === 'split' ? (
          renderTextSplitRows(textRichItems)
        ) : (
          renderTextDiffRows(textRichItems)
        )
      ) : (
        <pre className="result-output">{raw}</pre>
      )}
    </CompareResultShell>
  )
}
