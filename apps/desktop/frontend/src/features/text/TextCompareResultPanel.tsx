import { useRef } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { IconCopy } from '@tabler/icons-react'
import type { CompareResponse } from '../../types'
import { renderResult } from '../../utils/appHelpers'
import { CompareDiffNavControls } from '../../ui/CompareDiffNavControls'
import { CompareResultToolbar } from '../../ui/CompareResultToolbar'
import { CompareSearchControls } from '../../ui/CompareSearchControls'
import {
  CompareStatusBadges,
  type CompareStatusBadgeItem,
} from '../../ui/CompareStatusBadges'
import { ViewSettingsMenu } from '../../ui/ViewSettingsMenu'
import { CompareResultShell } from '../../ui/CompareResultShell'
import { RichDiffViewer } from '../../ui/RichDiffViewer'
import { useCompareKeyboardShortcuts } from '../../ui/useCompareKeyboardShortcuts'
import {
  summarizeTextDiffCounts,
  type RichDiffItem,
  type TextDiffBlock,
  type TextSearchMatch,
  type UnifiedDiffRow,
} from './textDiff'
import type { TextDiffLayout, TextResultView } from './useTextDiffViewState'

export type TextCompareResultPanelProps = {
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
  registerTextSearchRowRef: (matchId: string) => (node: HTMLDivElement | null) => void
  textDiffBlocks: TextDiffBlock[]
  textActiveDiffIndex: number
  activeTextDiffBlock: TextDiffBlock | null
  moveTextDiff: (direction: 1 | -1) => void
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
  registerTextSearchRowRef,
  textDiffBlocks,
  textActiveDiffIndex,
  activeTextDiffBlock,
  moveTextDiff,
}: TextCompareResultPanelProps) {
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
  const textSearchMatchIds = new Set(textSearchMatches.map((match) => match.id))
  const activeTextSearchMatchId = textSearchMatches[textActiveSearchIndex]?.id ?? null
  const textDiffBlockIds = new Set(textDiffBlocks.map((block) => block.id))
  const activeTextDiffBlockId = activeTextDiffBlock?.id ?? null
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useCompareKeyboardShortcuts({
    enabled: hasTextResult,
    searchInputRef,
    canFocusSearch: canSearchRich,
    onMoveSearch: textSearchMatches.length > 0 ? moveTextSearch : undefined,
    onMoveDiff:
      canRenderTextRich && textDiffBlocks.length > 0 ? moveTextDiff : undefined,
  })

  return (
    <CompareResultShell
      hasResult={hasTextResult}
      toolbar={
        <CompareResultToolbar
          primary={
            <>
              <CompareSearchControls
                inputRef={searchInputRef}
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
                    e.preventDefault()
                    if (textSearchQuery.length > 0) {
                      setTextSearchQuery('')
                      return
                    }
                    e.currentTarget.blur()
                  }
                }}
              />
              <CompareDiffNavControls
                count={textDiffBlocks.length}
                activeIndex={textActiveDiffIndex}
                onPrev={() => moveTextDiff(-1)}
                onNext={() => moveTextDiff(1)}
                disabled={!canRenderTextRich}
              />
            </>
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
        <RichDiffViewer
          items={textRichItems}
          layout={textDiffLayout}
          keyPrefix="text"
          searchMatchIds={textSearchMatchIds}
          activeMatchId={activeTextSearchMatchId}
          navMatchIds={textDiffBlockIds}
          activeNavMatchId={activeTextDiffBlockId}
          registerSearchRowRef={registerTextSearchRowRef}
          omittedSections={{
            isExpanded: isTextSectionExpanded,
            renderAction: (sectionId, expanded) => (
              <button
                type="button"
                className="text-omitted-action button-secondary button-compact"
                onClick={() => toggleTextUnchangedSection(sectionId)}
              >
                {expanded ? 'Collapse unchanged' : 'Show hidden lines'}
              </button>
            ),
          }}
        />
      ) : (
        <pre className="result-output">{raw}</pre>
      )}
    </CompareResultShell>
  )
}
