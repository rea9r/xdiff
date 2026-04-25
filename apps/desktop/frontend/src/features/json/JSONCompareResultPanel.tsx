import { Fragment, useEffect, useRef } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { IconCopy } from '@tabler/icons-react'
import type { CompareResponse, JSONRichDiffItem } from '../../types'
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
import { CompareSectionHeader } from '../../ui/CompareSectionHeader'
import { CompareValueBlock } from '../../ui/CompareValueBlock'
import { CompareStatusState } from '../../ui/CompareStatusState'
import { RichDiffViewer } from '../../ui/RichDiffViewer'
import type { RichDiffItem, TextSearchMatch } from '../text/textDiff'
import { buildJSONSemanticDiffRowID } from './useJSONCompareViewState'

export type JSONCompareResultPanelProps = {
  jsonResult: CompareResponse | null
  jsonResultView: 'diff' | 'semantic' | 'raw'
  setJSONResultView: (value: 'diff' | 'semantic' | 'raw') => void
  textDiffLayout: 'split' | 'unified'
  setTextDiffLayout: (value: 'split' | 'unified') => void
  jsonSearchQuery: string
  setJSONSearchQuery: (value: string) => void
  jsonActiveSearchIndex: number
  normalizedJSONSearchQuery: string
  jsonSearchMatches: number[]
  jsonDiffSearchMatches: TextSearchMatch[]
  jsonDiffSearchMatchIds: Set<string>
  activeJSONDiffSearchMatchId: string | null
  canRenderJSONRich: boolean
  canRenderJSONDiff: boolean
  jsonCopyBusy: boolean
  copyJSONResultRawOutput: () => void | Promise<void>
  moveJSONSearch: (direction: 1 | -1) => void
  jsonDiffTextItems: RichDiffItem[] | null
  jsonDiffRows: JSONRichDiffItem[]
  jsonSummary?: {
    added: number
    removed: number
    changed: number
    typeChanged: number
  }
  jsonDiffGroups: Array<{
    key: string
    items: JSONRichDiffItem[]
    summary: {
      added: number
      removed: number
      changed: number
      typeChanged: number
    }
  }>
  effectiveJSONExpandedGroups: Set<string>
  jsonSearchMatchIndexSet: Set<number>
  jsonExpandedValueKeys: string[]
  toggleJSONGroup: (groupKey: string) => void
  toggleJSONExpandedValue: (valueKey: string) => void
  registerJSONDiffSearchRowRef: (matchId: string) => (node: HTMLDivElement | null) => void
  jsonDiffNavCount: number
  jsonActiveDiffIndex: number
  activeJSONSemanticDiffIndex: number
  jsonDiffTextBlockIds: Set<string>
  activeJSONDiffTextBlockId: string | null
  moveJSONDiff: (direction: 1 | -1) => void
  registerJSONSemanticDiffRowRef: (id: string) => (node: HTMLTableRowElement | null) => void
}

function stringifyJSONValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return ''
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function buildJSONSummaryBadgeItems(params: {
  hasResult: boolean
  hasError: boolean
  diffFound: boolean
  added: number
  removed: number
  changed: number
  typeChanged: number
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
      tone: 'changed',
    })
  }
  return items
}

function renderHighlightedText(value: string, normalizedQuery: string) {
  if (!normalizedQuery) {
    return value
  }

  const lower = value.toLowerCase()
  const parts: Array<{ text: string; hit: boolean }> = []
  let cursor = 0

  while (cursor < value.length) {
    const found = lower.indexOf(normalizedQuery, cursor)
    if (found === -1) {
      parts.push({ text: value.slice(cursor), hit: false })
      break
    }

    if (found > cursor) {
      parts.push({ text: value.slice(cursor, found), hit: false })
    }
    parts.push({ text: value.slice(found, found + normalizedQuery.length), hit: true })
    cursor = found + normalizedQuery.length
  }

  return parts.map((part, index) =>
    part.hit ? (
      <span key={`hit-${index}`} className="json-search-hit">
        {part.text}
      </span>
    ) : (
      <span key={`plain-${index}`}>{part.text}</span>
    ),
  )
}

function renderJSONTypeLabel(type: JSONRichDiffItem['type']) {
  if (type === 'type_changed') {
    return 'type changed'
  }
  return type
}

function JSONValueCell({
  value,
  valueKey,
  normalizedQuery,
  expandedValueKeys,
  onToggle,
}: {
  value: unknown
  valueKey: string
  normalizedQuery: string
  expandedValueKeys: string[]
  onToggle: (valueKey: string) => void
}) {
  if (value === undefined) {
    return <span className="muted">—</span>
  }

  if (value === null) {
    return <CompareValueBlock inline>null</CompareValueBlock>
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value)
    return (
      <CompareValueBlock inline>{renderHighlightedText(text, normalizedQuery)}</CompareValueBlock>
    )
  }

  const rendered = stringifyJSONValue(value)
  const lines = rendered.split('\n')
  const canExpand = lines.length > 5
  const expanded = expandedValueKeys.includes(valueKey)
  const shown = canExpand && !expanded ? [...lines.slice(0, 5), '...'] : lines

  return (
    <div className="json-value-wrap">
      <CompareValueBlock expanded={expanded}>{shown.join('\n')}</CompareValueBlock>
      {canExpand ? (
        <button
          type="button"
          className="button-secondary button-compact json-value-toggle"
          onClick={() => onToggle(valueKey)}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      ) : null}
    </div>
  )
}

export function JSONCompareResultPanel({
  jsonResult,
  jsonResultView,
  setJSONResultView,
  textDiffLayout,
  setTextDiffLayout,
  jsonSearchQuery,
  setJSONSearchQuery,
  jsonActiveSearchIndex,
  normalizedJSONSearchQuery,
  jsonSearchMatches,
  jsonDiffSearchMatches,
  jsonDiffSearchMatchIds,
  activeJSONDiffSearchMatchId,
  canRenderJSONRich,
  canRenderJSONDiff,
  jsonCopyBusy,
  copyJSONResultRawOutput,
  moveJSONSearch,
  jsonDiffTextItems,
  jsonDiffRows,
  jsonSummary,
  jsonDiffGroups,
  effectiveJSONExpandedGroups,
  jsonSearchMatchIndexSet,
  jsonExpandedValueKeys,
  toggleJSONGroup,
  toggleJSONExpandedValue,
  registerJSONDiffSearchRowRef,
  jsonDiffNavCount,
  jsonActiveDiffIndex,
  activeJSONSemanticDiffIndex,
  jsonDiffTextBlockIds,
  activeJSONDiffTextBlockId,
  moveJSONDiff,
  registerJSONSemanticDiffRowRef,
}: JSONCompareResultPanelProps) {
  const raw = jsonResult ? renderResult(jsonResult) : ''
  const showDiff = jsonResultView === 'diff' && canRenderJSONDiff && !!jsonDiffTextItems
  const showSemantic = jsonResultView === 'semantic' && canRenderJSONRich
  const canSearch =
    jsonResultView === 'semantic'
      ? showSemantic
      : jsonResultView === 'diff'
        ? showDiff
        : false
  const canNavigate = showDiff || showSemantic
  const activeJSONMatch = jsonSearchMatches[jsonActiveSearchIndex] ?? -1
  const moveJSONDiffRef = useRef(moveJSONDiff)
  moveJSONDiffRef.current = moveJSONDiff

  useEffect(() => {
    if (!canNavigate || jsonDiffNavCount === 0) {
      return
    }

    const handler = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) {
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && target.tagName === 'INPUT') {
        return
      }

      event.preventDefault()
      moveJSONDiffRef.current(event.key === 'ArrowDown' ? 1 : -1)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canNavigate, jsonDiffNavCount])
  const hasJSONResult = !!jsonResult
  const jsonDiffRowIndexMap = new Map<JSONRichDiffItem, number>()
  jsonDiffRows.forEach((diff, index) => {
    jsonDiffRowIndexMap.set(diff, index)
  })
  const jsonSummaryItems = buildJSONSummaryBadgeItems({
    hasResult: hasJSONResult,
    hasError: !!jsonResult?.error,
    diffFound: !!jsonResult?.diffFound,
    added: jsonSummary?.added ?? 0,
    removed: jsonSummary?.removed ?? 0,
    changed: jsonSummary?.changed ?? 0,
    typeChanged: jsonSummary?.typeChanged ?? 0,
  })
  const jsonSearchStatus = normalizedJSONSearchQuery
    ? (jsonResultView === 'semantic' ? jsonSearchMatches.length : jsonDiffSearchMatches.length) > 0
      ? `${jsonActiveSearchIndex + 1} / ${
          jsonResultView === 'semantic' ? jsonSearchMatches.length : jsonDiffSearchMatches.length
        }`
      : '0 matches'
    : null

  return (
    <CompareResultShell
      hasResult={hasJSONResult}
      toolbar={
        <CompareResultToolbar
          primary={
            <>
              <CompareSearchControls
                value={jsonSearchQuery}
                placeholder={
                  jsonResultView === 'semantic' ? 'Search paths or values' : 'Search diff'
                }
                statusText={jsonSearchStatus}
                disabled={!canSearch}
                onChange={setJSONSearchQuery}
                onPrev={() => moveJSONSearch(-1)}
                onNext={() => moveJSONSearch(1)}
                prevDisabled={
                  !canSearch ||
                  (jsonResultView === 'semantic'
                    ? jsonSearchMatches.length === 0
                    : jsonDiffSearchMatches.length === 0)
                }
                nextDisabled={
                  !canSearch ||
                  (jsonResultView === 'semantic'
                    ? jsonSearchMatches.length === 0
                    : jsonDiffSearchMatches.length === 0)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    moveJSONSearch(e.shiftKey ? -1 : 1)
                    return
                  }

                  if (e.key === 'Escape') {
                    setJSONSearchQuery('')
                  }
                }}
              />
              <CompareDiffNavControls
                count={jsonDiffNavCount}
                activeIndex={jsonActiveDiffIndex}
                onPrev={() => moveJSONDiff(-1)}
                onNext={() => moveJSONDiff(1)}
                disabled={!canNavigate}
              />
            </>
          }
          summary={<CompareStatusBadges items={jsonSummaryItems} />}
          secondary={
            <>
              <Tooltip label="Copy raw output">
                <ActionIcon
                  variant="default"
                  size={28}
                  aria-label="Copy raw output"
                  className="text-result-action"
                  onClick={() => void copyJSONResultRawOutput()}
                  disabled={jsonCopyBusy || !raw}
                  loading={jsonCopyBusy}
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
                        key: 'json-display-diff',
                        label: 'Diff',
                        active: jsonResultView === 'diff',
                        disabled: !canRenderJSONDiff,
                        onSelect: () => setJSONResultView('diff'),
                      },
                      {
                        key: 'json-display-semantic',
                        label: 'Semantic',
                        active: jsonResultView === 'semantic',
                        disabled: !canRenderJSONRich,
                        onSelect: () => setJSONResultView('semantic'),
                      },
                      {
                        key: 'json-display-raw',
                        label: 'Raw',
                        active: jsonResultView === 'raw',
                        onSelect: () => setJSONResultView('raw'),
                      },
                    ],
                  },
                  {
                    title: 'Layout',
                    items: [
                      {
                        key: 'json-layout-split',
                        label: 'Split',
                        active: textDiffLayout === 'split',
                        disabled: jsonResultView !== 'diff' || !canRenderJSONDiff,
                        onSelect: () => setTextDiffLayout('split'),
                      },
                      {
                        key: 'json-layout-unified',
                        label: 'Unified',
                        active: textDiffLayout === 'unified',
                        disabled: jsonResultView !== 'diff' || !canRenderJSONDiff,
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
      {showDiff && jsonDiffTextItems ? (
        <RichDiffViewer
          items={jsonDiffTextItems}
          layout={textDiffLayout}
          keyPrefix="json"
          searchMatchIds={jsonDiffSearchMatchIds}
          activeMatchId={activeJSONDiffSearchMatchId}
          navMatchIds={jsonDiffTextBlockIds}
          activeNavMatchId={activeJSONDiffTextBlockId}
          registerSearchRowRef={registerJSONDiffSearchRowRef}
        />
      ) : showSemantic ? (
        <div className="json-diff-table-wrap">
          {jsonDiffRows.length === 0 ? (
            <CompareStatusState kind="success-empty" />
          ) : (
            <table className="json-diff-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Path</th>
                  <th>Old</th>
                  <th>New</th>
                </tr>
              </thead>
              <tbody>
                {jsonDiffGroups.map((group) => {
                  const expanded = effectiveJSONExpandedGroups.has(group.key)
                  return (
                    <Fragment key={`group-${group.key}`}>
                      <tr key={`group-${group.key}`} className="json-group-row">
                        <td colSpan={4}>
                          <CompareSectionHeader
                            title={group.key}
                            countLabel={`${group.items.length} changes`}
                            collapsed={!expanded}
                            onToggle={() => toggleJSONGroup(group.key)}
                            badges={
                              <>
                                {group.summary.added > 0 ? (
                                  <span className="json-group-stat added">+{group.summary.added}</span>
                                ) : null}
                                {group.summary.removed > 0 ? (
                                  <span className="json-group-stat removed">-{group.summary.removed}</span>
                                ) : null}
                                {group.summary.changed > 0 ? (
                                  <span className="json-group-stat changed">~{group.summary.changed}</span>
                                ) : null}
                                {group.summary.typeChanged > 0 ? (
                                  <span className="json-group-stat type-changed">
                                    type {group.summary.typeChanged}
                                  </span>
                                ) : null}
                              </>
                            }
                          />
                        </td>
                      </tr>

                      {expanded
                        ? group.items.map((diff) => {
                            const index = jsonDiffRowIndexMap.get(diff) ?? -1
                            const searchHit = jsonSearchMatchIndexSet.has(index)
                            const activeHit = activeJSONMatch === index
                            const isActiveNavRow = activeJSONSemanticDiffIndex === index
                            const rowID = buildJSONSemanticDiffRowID(index)
                            return (
                              <tr
                                key={`${diff.type}-${diff.path}-${index}`}
                                ref={registerJSONSemanticDiffRowRef(rowID)}
                                className={[
                                  'json-diff-row',
                                  diff.type,
                                  searchHit ? 'search-hit' : '',
                                  activeHit ? 'active-search-hit' : '',
                                  isActiveNavRow ? 'active-diff-hit' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                <td className="json-diff-cell json-diff-cell-type">
                                  <div className="json-cell-inline json-type-cell">
                                    <span className={`json-type-badge ${diff.type}`}>
                                      {renderJSONTypeLabel(diff.type)}
                                    </span>
                                  </div>
                                </td>
                                <td className="json-diff-cell json-diff-cell-path">
                                  <div className="json-cell-inline json-path-cell">
                                    {renderHighlightedText(diff.path, normalizedJSONSearchQuery)}
                                  </div>
                                </td>
                                <td>
                                  <JSONValueCell
                                    value={diff.oldValue}
                                    valueKey={`${index}:${diff.path}:old`}
                                    normalizedQuery={normalizedJSONSearchQuery}
                                    expandedValueKeys={jsonExpandedValueKeys}
                                    onToggle={toggleJSONExpandedValue}
                                  />
                                </td>
                                <td>
                                  <JSONValueCell
                                    value={diff.newValue}
                                    valueKey={`${index}:${diff.path}:new`}
                                    normalizedQuery={normalizedJSONSearchQuery}
                                    expandedValueKeys={jsonExpandedValueKeys}
                                    onToggle={toggleJSONExpandedValue}
                                  />
                                </td>
                              </tr>
                            )
                          })
                        : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <pre className="result-output">{raw}</pre>
      )}
    </CompareResultShell>
  )
}
