import { ActionIcon, Tooltip } from '@mantine/core'
import { IconCopy } from '@tabler/icons-react'
import type { CompareResponse, CompareSpecRichResponse } from '../../types'
import { renderResult } from '../../utils/appHelpers'
import { CompareResultToolbar } from '../../ui/CompareResultToolbar'
import { CompareSearchControls } from '../../ui/CompareSearchControls'
import {
  CompareStatusBadges,
  type CompareStatusBadgeItem,
} from '../../ui/CompareStatusBadges'
import { ViewSettingsMenu } from '../../ui/ViewSettingsMenu'
import { CompareResultShell } from '../../ui/CompareResultShell'
import { SpecRichDiffViewer } from '../../ui/SpecRichDiffViewer'
import { RichDiffViewer } from '../../ui/RichDiffViewer'
import type { RichDiffItem, TextSearchMatch } from '../text/textDiff'

export type SpecCompareResultPanelProps = {
  specResult: CompareResponse | null
  specRichResult: CompareSpecRichResponse | null
  specResultView: 'diff' | 'semantic' | 'raw'
  setSpecResultView: (value: 'diff' | 'semantic' | 'raw') => void
  textDiffLayout: 'split' | 'unified'
  setTextDiffLayout: (value: 'split' | 'unified') => void
  specSearchQuery: string
  setSpecSearchQuery: (value: string) => void
  specActiveSearchIndex: number
  normalizedSpecSearchQuery: string
  specSearchMatches: number[]
  specDiffSearchMatches: TextSearchMatch[]
  specDiffSearchMatchIds: Set<string>
  activeSpecDiffSearchMatchId: string | null
  canRenderSpecDiff: boolean
  specCopyBusy: boolean
  copySpecResultRawOutput: () => void | Promise<void>
  moveSpecSearch: (direction: 1 | -1) => void
  specDiffTextItems: RichDiffItem[] | null
  specSearchMatchIndexSet: Set<number>
  registerSpecDiffSearchRowRef: (matchId: string) => (node: HTMLDivElement | null) => void
}

function buildSpecSummaryBadgeItems(params: {
  hasResult: boolean
  hasError: boolean
  diffFound: boolean
  added: number
  removed: number
  changed: number
  typeChanged: number
  breaking: number
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
  if (params.changed > 0) {
    items.push({ key: 'changed', label: `~${params.changed}`, tone: 'changed' })
  }
  if (params.typeChanged > 0) {
    items.push({
      key: 'typeChanged',
      label: `type ${params.typeChanged}`,
      tone: 'breaking',
    })
  }
  if (params.breaking > 0) {
    items.push({ key: 'breaking', label: `breaking ${params.breaking}`, tone: 'breaking' })
  }
  return items
}

export function SpecCompareResultPanel({
  specResult,
  specRichResult,
  specResultView,
  setSpecResultView,
  textDiffLayout,
  setTextDiffLayout,
  specSearchQuery,
  setSpecSearchQuery,
  specActiveSearchIndex,
  normalizedSpecSearchQuery,
  specSearchMatches,
  specDiffSearchMatches,
  specDiffSearchMatchIds,
  activeSpecDiffSearchMatchId,
  canRenderSpecDiff,
  specCopyBusy,
  copySpecResultRawOutput,
  moveSpecSearch,
  specDiffTextItems,
  specSearchMatchIndexSet,
  registerSpecDiffSearchRowRef,
}: SpecCompareResultPanelProps) {
  const raw = specResult ? renderResult(specResult) : ''
  const showDiff = specResultView === 'diff' && canRenderSpecDiff && !!specDiffTextItems
  const showSemantic = specResultView === 'semantic' && !!specRichResult && !specResult?.error
  const canSearch =
    specResultView === 'semantic'
      ? showSemantic
      : specResultView === 'diff'
        ? showDiff
        : false
  const activeSpecMatch = specSearchMatches[specActiveSearchIndex] ?? -1
  const summary = specRichResult?.summary
  const specSummaryItems = buildSpecSummaryBadgeItems({
    hasResult: !!specResult,
    hasError: !!specResult?.error,
    diffFound: !!specResult?.diffFound,
    added: summary?.added ?? 0,
    removed: summary?.removed ?? 0,
    changed: summary?.changed ?? 0,
    typeChanged: summary?.typeChanged ?? 0,
    breaking: summary?.breaking ?? 0,
  })
  const specSearchStatus = normalizedSpecSearchQuery
    ? (specResultView === 'semantic' ? specSearchMatches.length : specDiffSearchMatches.length) > 0
      ? `${specActiveSearchIndex + 1} / ${
          specResultView === 'semantic' ? specSearchMatches.length : specDiffSearchMatches.length
        }`
      : '0 matches'
    : null

  return (
    <CompareResultShell
      hasResult={!!specResult}
      toolbar={
        <CompareResultToolbar
          primary={
            <CompareSearchControls
              value={specSearchQuery}
              placeholder={specResultView === 'semantic' ? 'Search paths or labels' : 'Search diff'}
              statusText={specSearchStatus}
              disabled={!canSearch}
              onChange={setSpecSearchQuery}
              onPrev={() => moveSpecSearch(-1)}
              onNext={() => moveSpecSearch(1)}
              prevDisabled={
                !canSearch ||
                (specResultView === 'semantic'
                  ? specSearchMatches.length === 0
                  : specDiffSearchMatches.length === 0)
              }
              nextDisabled={
                !canSearch ||
                (specResultView === 'semantic'
                  ? specSearchMatches.length === 0
                  : specDiffSearchMatches.length === 0)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  moveSpecSearch(e.shiftKey ? -1 : 1)
                  return
                }

                if (e.key === 'Escape') {
                  setSpecSearchQuery('')
                }
              }}
            />
          }
          summary={<CompareStatusBadges items={specSummaryItems} />}
          secondary={
            <>
              <Tooltip label="Copy raw output">
                <ActionIcon
                  variant="default"
                  size={28}
                  aria-label="Copy raw output"
                  className="text-result-action"
                  onClick={() => void copySpecResultRawOutput()}
                  disabled={specCopyBusy || !raw}
                  loading={specCopyBusy}
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
                        key: 'spec-display-diff',
                        label: 'Diff',
                        active: specResultView === 'diff',
                        disabled: !canRenderSpecDiff,
                        onSelect: () => setSpecResultView('diff'),
                      },
                      {
                        key: 'spec-display-semantic',
                        label: 'Semantic',
                        active: specResultView === 'semantic',
                        disabled: !specRichResult || !!specResult?.error,
                        onSelect: () => setSpecResultView('semantic'),
                      },
                      {
                        key: 'spec-display-raw',
                        label: 'Raw',
                        active: specResultView === 'raw',
                        onSelect: () => setSpecResultView('raw'),
                      },
                    ],
                  },
                  {
                    title: 'Layout',
                    items: [
                      {
                        key: 'spec-layout-split',
                        label: 'Split',
                        active: textDiffLayout === 'split',
                        disabled: specResultView !== 'diff' || !canRenderSpecDiff,
                        onSelect: () => setTextDiffLayout('split'),
                      },
                      {
                        key: 'spec-layout-unified',
                        label: 'Unified',
                        active: textDiffLayout === 'unified',
                        disabled: specResultView !== 'diff' || !canRenderSpecDiff,
                        onSelect: () => setTextDiffLayout('unified'),
                      },
                    ],
                  },
                ]}
              />
            </>
          }
        />
      }
    >
      {showDiff && specDiffTextItems ? (
        <RichDiffViewer
          items={specDiffTextItems}
          layout={textDiffLayout}
          keyPrefix="spec"
          searchMatchIds={specDiffSearchMatchIds}
          activeMatchId={activeSpecDiffSearchMatchId}
          registerSearchRowRef={registerSpecDiffSearchRowRef}
        />
      ) : showSemantic && specRichResult ? (
        <SpecRichDiffViewer
          diffs={specRichResult.diffs}
          searchQuery={specSearchQuery}
          searchMatchIndexSet={specSearchMatchIndexSet}
          activeMatchIndex={activeSpecMatch}
        />
      ) : (
        <pre className="result-output">{raw}</pre>
      )}
    </CompareResultShell>
  )
}
