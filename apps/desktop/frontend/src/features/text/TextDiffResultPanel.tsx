import { useRef } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCopy,
  IconSpace,
  IconSpaceOff,
} from '@tabler/icons-react'
import type { DiffResponse } from '../../types'
import { AIInlineSummary } from '../ai/AIInlineSummary'
import { renderResult } from '../../utils/appHelpers'
import { DiffNavControls } from '../../ui/DiffNavControls'
import { DiffResultToolbar } from '../../ui/DiffResultToolbar'
import { DiffSearchControls } from '../../ui/DiffSearchControls'
import {
  DiffStatusBadges,
  type DiffStatusBadgeItem,
} from '../../ui/DiffStatusBadges'
import { ViewSettingsMenu } from '../../ui/ViewSettingsMenu'
import { DiffResultShell } from '../../ui/DiffResultShell'
import { RichDiffViewer } from '../../ui/RichDiffViewer'
import { useDiffKeyboardShortcuts } from '../../ui/useDiffKeyboardShortcuts'
import {
  summarizeTextDiffCounts,
  type RichDiffItem,
  type TextChangeBlock,
  type TextDiffBlock,
  type TextSearchMatch,
  type UnifiedDiffRow,
} from './textDiff'
import type { AdoptBlockHandler } from '../../ui/RichDiffViewer'
import type { TextDiffLayout, TextResultView } from './useTextDiffViewState'

export type TextDiffResultPanelProps = {
  textResult: DiffResponse | null
  textResultView: TextResultView
  setTextResultView: (value: TextResultView) => void
  textDiffLayout: TextDiffLayout
  setTextDiffLayout: (value: TextDiffLayout) => void
  textWrap: boolean
  setTextWrap: (value: boolean) => void
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
  toggleAllTextUnchangedSections: () => void
  getTextSectionExpansion: (sectionId: string) => { top: number; bottom: number }
  expandTextSection: (sectionId: string, side: 'top' | 'bottom' | 'all') => void
  registerTextSearchRowRef: (matchId: string) => (node: HTMLDivElement | null) => void
  textDiffBlocks: TextDiffBlock[]
  textChangeBlocks: TextChangeBlock[]
  textActiveDiffIndex: number
  activeTextDiffBlock: TextDiffBlock | null
  moveTextDiff: (direction: 1 | -1) => void
  onAdoptBlock?: AdoptBlockHandler
  canUndoAdopt?: boolean
  canRedoAdopt?: boolean
  onUndoAdopt?: () => void
  onRedoAdopt?: () => void
  ignoreWhitespace: boolean
  onToggleIgnoreWhitespace: () => void
}

function buildTextSummaryBadgeItems(params: {
  hasResult: boolean
  hasError: boolean
  diffFound: boolean
  added: number
  removed: number
}): DiffStatusBadgeItem[] {
  if (!params.hasResult) {
    return []
  }

  if (params.hasError) {
    return [{ key: 'error', label: 'Execution error', tone: 'error' }]
  }

  if (!params.diffFound) {
    return [{ key: 'none', label: 'No differences', tone: 'neutral' }]
  }

  const items: DiffStatusBadgeItem[] = []
  if (params.added > 0) {
    items.push({ key: 'added', label: `+${params.added}`, tone: 'added' })
  }
  if (params.removed > 0) {
    items.push({ key: 'removed', label: `-${params.removed}`, tone: 'removed' })
  }
  return items
}

export function TextDiffResultPanel({
  textResult,
  textResultView,
  setTextResultView,
  textDiffLayout,
  setTextDiffLayout,
  textWrap,
  setTextWrap,
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
  toggleAllTextUnchangedSections,
  getTextSectionExpansion,
  expandTextSection,
  registerTextSearchRowRef,
  textDiffBlocks,
  textChangeBlocks,
  textActiveDiffIndex,
  activeTextDiffBlock,
  moveTextDiff,
  onAdoptBlock,
  canUndoAdopt = false,
  canRedoAdopt = false,
  onUndoAdopt,
  onRedoAdopt,
  ignoreWhitespace,
  onToggleIgnoreWhitespace,
}: TextDiffResultPanelProps) {
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
  const canExplain = hasTextResult && !!raw && !textResult?.error
  const aiHint =
    diffCounts.added > 0 || diffCounts.removed > 0
      ? `+${diffCounts.added} / -${diffCounts.removed}`
      : undefined

  const showAdoptHistoryControls = !!onAdoptBlock && (canUndoAdopt || canRedoAdopt)
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
  const undoShortcut = isMac ? '⌘Z' : 'Ctrl+Z'
  const redoShortcut = isMac ? '⇧⌘Z' : 'Ctrl+Y'

  useDiffKeyboardShortcuts({
    enabled: hasTextResult,
    searchInputRef,
    canFocusSearch: canSearchRich,
    onMoveSearch: textSearchMatches.length > 0 ? moveTextSearch : undefined,
    onMoveDiff:
      canRenderTextRich && textDiffBlocks.length > 0 ? moveTextDiff : undefined,
    onUndo: canUndoAdopt ? onUndoAdopt : undefined,
    onRedo: canRedoAdopt ? onRedoAdopt : undefined,
  })

  return (
    <DiffResultShell
      hasResult={hasTextResult}
      toolbar={
        <DiffResultToolbar
          primary={
            <>
              <DiffSearchControls
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
              <DiffNavControls
                count={textDiffBlocks.length}
                activeIndex={textActiveDiffIndex}
                onPrev={() => moveTextDiff(-1)}
                onNext={() => moveTextDiff(1)}
                disabled={!canRenderTextRich}
              />
              {showAdoptHistoryControls ? (
                <>
                  <Tooltip label={`Undo adopt (${undoShortcut})`}>
                    <ActionIcon
                      variant={canUndoAdopt ? 'light' : 'default'}
                      color={canUndoAdopt ? 'blue' : undefined}
                      size={28}
                      aria-label="Undo adopt"
                      className="text-result-action"
                      onClick={() => onUndoAdopt?.()}
                      disabled={!canUndoAdopt || !onUndoAdopt}
                    >
                      <IconArrowBackUp size={15} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={`Redo adopt (${redoShortcut})`}>
                    <ActionIcon
                      variant={canRedoAdopt ? 'light' : 'default'}
                      color={canRedoAdopt ? 'blue' : undefined}
                      size={28}
                      aria-label="Redo adopt"
                      className="text-result-action"
                      onClick={() => onRedoAdopt?.()}
                      disabled={!canRedoAdopt || !onRedoAdopt}
                    >
                      <IconArrowForwardUp size={15} />
                    </ActionIcon>
                  </Tooltip>
                </>
              ) : null}
            </>
          }
          summary={<DiffStatusBadges items={textSummaryItems} />}
          secondary={
            <>
              <Tooltip label={ignoreWhitespace ? 'Show whitespace' : 'Hide whitespace'}>
                <ActionIcon
                  variant={ignoreWhitespace ? 'light' : 'default'}
                  color={ignoreWhitespace ? 'blue' : undefined}
                  size={28}
                  aria-label={ignoreWhitespace ? 'Show whitespace' : 'Hide whitespace'}
                  aria-pressed={ignoreWhitespace}
                  className="text-result-action"
                  onClick={onToggleIgnoreWhitespace}
                  disabled={!hasTextResult}
                >
                  {ignoreWhitespace ? <IconSpaceOff size={15} /> : <IconSpace size={15} />}
                </ActionIcon>
              </Tooltip>
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
                      {
                        key: 'text-layout-wrap',
                        label: 'Wrap lines',
                        active: textWrap,
                        disabled: textResultView !== 'diff' || !canRenderTextRich,
                        onSelect: () => setTextWrap(!textWrap),
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
      {canExplain ? (
        <AIInlineSummary
          cacheKey={raw}
          diffText={raw}
          ctaLabel="Explain this diff with local AI"
          ctaHint={aiHint}
          mode="text"
        />
      ) : null}
      {showRich && textRichItems ? (
        <RichDiffViewer
          items={textRichItems}
          layout={textDiffLayout}
          wrap={textWrap}
          keyPrefix="text"
          searchMatchIds={textSearchMatchIds}
          activeMatchId={activeTextSearchMatchId}
          navMatchIds={textDiffBlockIds}
          activeNavMatchId={activeTextDiffBlockId}
          registerSearchRowRef={registerTextSearchRowRef}
          changeBlocks={textChangeBlocks}
          onAdoptBlock={onAdoptBlock}
          omittedSections={{
            getExpansion: getTextSectionExpansion,
            onExpandTop: (sectionId) => expandTextSection(sectionId, 'top'),
            onExpandBottom: (sectionId) => expandTextSection(sectionId, 'bottom'),
            onExpandAll: (sectionId) => expandTextSection(sectionId, 'all'),
          }}
        />
      ) : (
        <pre className="result-output">{raw}</pre>
      )}
    </DiffResultShell>
  )
}
