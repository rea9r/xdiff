import { Fragment, useEffect, useMemo, useState, type KeyboardEventHandler } from 'react'
import { ActionIcon } from '@mantine/core'
import {
  IconBinaryTree2,
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconFolderOpen,
  IconList,
} from '@tabler/icons-react'
import type { DiffDirectoriesResponse, DirectoryDiffItem } from '../../types'
import { SectionCard } from '../../ui/SectionCard'
import { StatusBadge } from '../../ui/StatusBadge'
import { DirectoryAISummaryCard } from './DirectoryAISummaryCard'
import { formatDirectoryDiffForAI } from './formatDirectoryDiffForAI'
import {
  canOpenDirectoryItem,
  directoryQuickFilterLabel,
  formatDirectorySide,
  formatDirectoryStatusLabel,
  getDirectoryItemActionReason,
  toneForDirectoryStatus,
  type DirectoryQuickFilter,
  type DirectorySortDirection,
  type DirectorySortKey,
  type DirectoryTreeNode,
  type DirectoryTreeRow,
  type DirectoryViewMode,
} from './directoryTree'

const QUICK_FILTERS: DirectoryQuickFilter[] = [
  'all',
  'changed',
  'left-only',
  'right-only',
  'type-mismatch',
  'error',
  'same',
]
const DEFAULT_DIRECTORY_VISIBLE_ROWS = 300

export type DirectoryDiffResultPanelProps = {
  directoryResult: DiffDirectoriesResponse | null
  directoryStatus: string
  directoryLeftRoot: string
  directoryRightRoot: string
  directoryNameFilter: string
  directoryCurrentPath: string
  directoryViewMode: DirectoryViewMode
  directoryQuickFilter: DirectoryQuickFilter
  directoryQuickFilterCounts: Record<DirectoryQuickFilter, number>
  directorySortKey: DirectorySortKey
  directorySortDirection: DirectorySortDirection
  directoryOpenBusyPath: string
  directoryTreeLoadingPath: string
  selectedDirectoryItemPath: string
  sortedDirectoryItems: DirectoryDiffItem[]
  flattenedDirectoryTreeRows: DirectoryTreeRow[]
  selectedDirectoryItemForDetail: DirectoryDiffItem | null
  directoryBreadcrumbs: Array<{ label: string; path: string }>
  loading: boolean
  onBrowseDirectoryRoot: (target: 'left' | 'right') => void | Promise<void>
  onSetDirectoryNameFilter: (value: string) => void
  onSetDirectoryViewMode: (viewMode: DirectoryViewMode) => void
  onSetDirectoryQuickFilter: (filter: DirectoryQuickFilter) => void
  onSelectDirectoryItemPath: (path: string) => void
  onNavigateDirectoryPath: (path: string) => void | Promise<void>
  onApplyDirectorySort: (key: DirectorySortKey) => void
  onOpenDirectoryEntryDiff: (item: DirectoryDiffItem) => void | Promise<void>
  onToggleDirectoryTreeNode: (node: DirectoryTreeNode) => void | Promise<void>
  onDirectoryRowDoubleClick: (item: DirectoryDiffItem) => void | Promise<void>
  onDirectoryTreeRowDoubleClick: (node: DirectoryTreeNode) => void | Promise<void>
  onDirectoryTableKeyDown: KeyboardEventHandler<HTMLDivElement>
}

function DirectorySortIndicator({
  active,
  direction,
}: {
  active: boolean
  direction: DirectorySortDirection
}) {
  if (!active) {
    return null
  }

  return <span className="directory-sort-indicator">{direction === 'asc' ? '▲' : '▼'}</span>
}

export function DirectoryDiffResultPanel({
  directoryResult,
  directoryStatus,
  directoryLeftRoot,
  directoryRightRoot,
  directoryNameFilter,
  directoryCurrentPath,
  directoryViewMode,
  directoryQuickFilter,
  directoryQuickFilterCounts,
  directorySortKey,
  directorySortDirection,
  directoryOpenBusyPath,
  directoryTreeLoadingPath,
  selectedDirectoryItemPath,
  sortedDirectoryItems,
  flattenedDirectoryTreeRows,
  selectedDirectoryItemForDetail,
  directoryBreadcrumbs,
  loading,
  onBrowseDirectoryRoot,
  onSetDirectoryNameFilter,
  onSetDirectoryViewMode,
  onSetDirectoryQuickFilter,
  onSelectDirectoryItemPath,
  onNavigateDirectoryPath,
  onApplyDirectorySort,
  onOpenDirectoryEntryDiff,
  onToggleDirectoryTreeNode,
  onDirectoryRowDoubleClick,
  onDirectoryTreeRowDoubleClick,
  onDirectoryTableKeyDown,
}: DirectoryDiffResultPanelProps) {
  const [visibleListRows, setVisibleListRows] = useState(DEFAULT_DIRECTORY_VISIBLE_ROWS)
  const [visibleTreeRows, setVisibleTreeRows] = useState(DEFAULT_DIRECTORY_VISIBLE_ROWS)
  const aiDiffText = useMemo(
    () => (directoryResult && !directoryResult.error ? formatDirectoryDiffForAI(directoryResult) : ''),
    [directoryResult],
  )
  const aiChangedCount = useMemo(() => {
    if (!directoryResult) return 0
    const s = directoryResult.scannedSummary
    return s.changed + s.leftOnly + s.rightOnly + s.typeMismatch + s.error
  }, [directoryResult])
  const canExplain = aiDiffText.length > 0

  useEffect(() => {
    setVisibleListRows(DEFAULT_DIRECTORY_VISIBLE_ROWS)
    setVisibleTreeRows(DEFAULT_DIRECTORY_VISIBLE_ROWS)
  }, [
    directoryCurrentPath,
    directoryNameFilter,
    directoryQuickFilter,
    directorySortDirection,
    directorySortKey,
    directoryViewMode,
    directoryResult?.currentPath,
  ])

  const detailActionReason = selectedDirectoryItemForDetail
    ? getDirectoryItemActionReason(selectedDirectoryItemForDetail)
    : null
  const currentPath = directoryResult?.currentPath ?? directoryCurrentPath
  const visibleCount =
    directoryViewMode === 'tree' ? flattenedDirectoryTreeRows.length : sortedDirectoryItems.length
  const canDiffDirectories = !!directoryLeftRoot && !!directoryRightRoot
  const shouldShowDirectoryDetail = !!selectedDirectoryItemForDetail
  const selectedListIndex = useMemo(
    () => sortedDirectoryItems.findIndex((item) => item.relativePath === selectedDirectoryItemPath),
    [selectedDirectoryItemPath, sortedDirectoryItems],
  )
  const selectedTreeIndex = useMemo(
    () => flattenedDirectoryTreeRows.findIndex((row) => row.node.path === selectedDirectoryItemPath),
    [flattenedDirectoryTreeRows, selectedDirectoryItemPath],
  )
  const effectiveVisibleListRows =
    selectedListIndex >= 0 ? Math.max(visibleListRows, selectedListIndex + 1) : visibleListRows
  const effectiveVisibleTreeRows =
    selectedTreeIndex >= 0 ? Math.max(visibleTreeRows, selectedTreeIndex + 1) : visibleTreeRows
  const visibleListItems = useMemo(
    () => sortedDirectoryItems.slice(0, effectiveVisibleListRows),
    [effectiveVisibleListRows, sortedDirectoryItems],
  )
  const visibleTreeItems = useMemo(
    () => flattenedDirectoryTreeRows.slice(0, effectiveVisibleTreeRows),
    [effectiveVisibleTreeRows, flattenedDirectoryTreeRows],
  )
  const hasMoreListItems = visibleListItems.length < sortedDirectoryItems.length
  const hasMoreTreeItems = visibleTreeItems.length < flattenedDirectoryTreeRows.length

  return (
    <SectionCard>
      <div className={`directory-result-shell ${directoryViewMode === 'tree' ? 'is-tree-mode' : ''}`.trim()}>
        <div className="directory-result-header">
          <div className="directory-header-bar">
            <div className="directory-header-context">
              <div className="directory-current-path" aria-label="Current path">
                {directoryBreadcrumbs.map((crumb, index) => (
                  <Fragment key={crumb.path || 'root'}>
                    {crumb.path === currentPath ? (
                      <span className="directory-breadcrumb-current">{crumb.label}</span>
                    ) : (
                      <button
                        type="button"
                        className="directory-breadcrumb-link"
                        onClick={() => void onNavigateDirectoryPath(crumb.path)}
                        disabled={loading || !canDiffDirectories}
                      >
                        {crumb.label}
                      </button>
                    )}
                    {index < directoryBreadcrumbs.length - 1 ? (
                      <span className="directory-breadcrumb-sep">/</span>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="directory-root-bar">
            <div
              className="directory-root-field"
              data-drop-target="directory-left"
              onClick={() => void onBrowseDirectoryRoot('left')}
              role="button"
              tabIndex={loading ? -1 : 0}
              onKeyDown={(event) => {
                if (loading) {
                  return
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void onBrowseDirectoryRoot('left')
                }
              }}
            >
              <span className="directory-root-label">Left</span>
              <input
                className="directory-root-input"
                readOnly
                value={directoryLeftRoot}
                placeholder="Select left directory"
                title={directoryLeftRoot || 'Select left directory'}
              />
              <ActionIcon
                variant="default"
                size={24}
                aria-label="Pick left directory"
                onClick={(event) => {
                  event.stopPropagation()
                  void onBrowseDirectoryRoot('left')
                }}
                disabled={loading}
              >
                <IconFolderOpen size={14} />
              </ActionIcon>
            </div>
            <div
              className="directory-root-field"
              data-drop-target="directory-right"
              onClick={() => void onBrowseDirectoryRoot('right')}
              role="button"
              tabIndex={loading ? -1 : 0}
              onKeyDown={(event) => {
                if (loading) {
                  return
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void onBrowseDirectoryRoot('right')
                }
              }}
            >
              <span className="directory-root-label">Right</span>
              <input
                className="directory-root-input"
                readOnly
                value={directoryRightRoot}
                placeholder="Select right directory"
                title={directoryRightRoot || 'Select right directory'}
              />
              <ActionIcon
                variant="default"
                size={24}
                aria-label="Pick right directory"
                onClick={(event) => {
                  event.stopPropagation()
                  void onBrowseDirectoryRoot('right')
                }}
                disabled={loading}
              >
                <IconFolderOpen size={14} />
              </ActionIcon>
            </div>
          </div>

          {directoryStatus ? <div className="muted">{directoryStatus}</div> : null}
        </div>

        <div className="directory-quick-filters">
          <div className="directory-result-toolbar-left">
            <div className="directory-compact-summary">
              <span>{directoryResult?.scannedSummary.total ?? 0} scanned</span>
              <span>{visibleCount} here</span>
            </div>
            <div className="directory-view-mode-toggle" role="tablist" aria-label="Directory view mode">
              <button
                type="button"
                className={`button-secondary button-compact ${
                  directoryViewMode === 'list' ? 'directory-quick-filter-active' : ''
                }`}
                onClick={() => onSetDirectoryViewMode('list')}
                role="tab"
                aria-selected={directoryViewMode === 'list'}
              >
                <IconList size={13} />
                List
              </button>
              <button
                type="button"
                className={`button-secondary button-compact ${
                  directoryViewMode === 'tree' ? 'directory-quick-filter-active' : ''
                }`}
                onClick={() => onSetDirectoryViewMode('tree')}
                role="tab"
                aria-selected={directoryViewMode === 'tree'}
              >
                <IconBinaryTree2 size={13} />
                Tree
              </button>
            </div>
          </div>
          <div className="directory-result-toolbar-right">
            {QUICK_FILTERS.filter((filterKey) => {
              if (filterKey === 'all' || filterKey === 'changed') return true
              if (directoryQuickFilter === filterKey) return true
              return directoryQuickFilterCounts[filterKey] > 0
            }).map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                className={`button-secondary button-compact ${
                  directoryQuickFilter === filterKey ? 'directory-quick-filter-active' : ''
                }`}
                onClick={() => onSetDirectoryQuickFilter(filterKey)}
              >
                {directoryQuickFilterLabel(filterKey)} ({directoryQuickFilterCounts[filterKey]})
              </button>
            ))}
            <input
              className="directory-name-filter-input"
              value={directoryNameFilter}
              onChange={(event) => onSetDirectoryNameFilter(event.target.value)}
              placeholder="name filter"
            />
          </div>
        </div>

        <div className="directory-list-tree-viewport">
          {canExplain ? (
            <DirectoryAISummaryCard diffText={aiDiffText} changedCount={aiChangedCount} />
          ) : null}
          {directoryResult?.error ? (
            <pre className="result-output">{directoryResult.error}</pre>
          ) : directoryResult ? (
            directoryViewMode === 'list' ? (
              <div
                className="directory-table-wrap"
                tabIndex={0}
                onKeyDown={onDirectoryTableKeyDown}
                onFocus={() => {
                  if (!selectedDirectoryItemPath && sortedDirectoryItems.length > 0) {
                    onSelectDirectoryItemPath(sortedDirectoryItems[0].relativePath)
                  }
                }}
              >
                <table className="directory-results-table">
                  <thead>
                    <tr>
                      <th className="directory-sortable-header" onClick={() => onApplyDirectorySort('name')}>
                        Name
                        <DirectorySortIndicator
                          active={directorySortKey === 'name'}
                          direction={directorySortDirection}
                        />
                      </th>
                      <th className="directory-sortable-header" onClick={() => onApplyDirectorySort('status')}>
                        Status
                        <DirectorySortIndicator
                          active={directorySortKey === 'status'}
                          direction={directorySortDirection}
                        />
                      </th>
                      <th className="directory-sortable-header" onClick={() => onApplyDirectorySort('left')}>
                        Left
                        <DirectorySortIndicator
                          active={directorySortKey === 'left'}
                          direction={directorySortDirection}
                        />
                      </th>
                      <th className="directory-sortable-header" onClick={() => onApplyDirectorySort('right')}>
                        Right
                        <DirectorySortIndicator
                          active={directorySortKey === 'right'}
                          direction={directorySortDirection}
                        />
                      </th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleListItems.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="muted">No entries to show.</div>
                        </td>
                      </tr>
                    ) : (
                      visibleListItems.map((item) => {
                        const openable = canOpenDirectoryItem(item)
                        const enterable = item.isDir && item.status !== 'type-mismatch'
                        const actionReason = getDirectoryItemActionReason(item)
                        const selected = item.relativePath === selectedDirectoryItemPath

                        return (
                          <tr
                            key={item.relativePath}
                            className={[
                              selected ? 'directory-row-selected' : '',
                              enterable || openable ? 'directory-row-clickable' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => onSelectDirectoryItemPath(item.relativePath)}
                            onDoubleClick={() => void onDirectoryRowDoubleClick(item)}
                          >
                            <td>
                              <div
                                className={`directory-item-name ${enterable ? 'is-dir' : ''}`}
                                onClick={(event) => {
                                  if (!enterable) return
                                  event.stopPropagation()
                                  void onNavigateDirectoryPath(item.relativePath)
                                }}
                              >
                                {item.isDir ? <IconFolderOpen size={14} /> : <IconFile size={14} />}
                                <span
                                  className="directory-entry-path"
                                  title={`${item.leftPath || '(missing)'}\n${item.rightPath || '(missing)'}`}
                                >
                                  {item.name}
                                </span>
                              </div>
                              {item.relativePath !== item.name ? (
                                <div className="directory-entry-sub muted">{item.relativePath}</div>
                              ) : null}
                              {item.message ? (
                                <div className="directory-entry-sub muted">{item.message}</div>
                              ) : null}
                            </td>
                            <td className="directory-status-cell">
                              <StatusBadge tone={toneForDirectoryStatus(item.status)}>
                                {formatDirectoryStatusLabel(item.status)}
                              </StatusBadge>
                            </td>
                            <td>{formatDirectorySide(item.leftExists, item.leftKind, item.leftSize)}</td>
                            <td>{formatDirectorySide(item.rightExists, item.rightKind, item.rightSize)}</td>
                            <td>
                              {enterable ? (
                                <button
                                  type="button"
                                  className="directory-action-button button-secondary button-compact"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void onNavigateDirectoryPath(item.relativePath)
                                  }}
                                  disabled={loading}
                                >
                                  Enter
                                </button>
                              ) : openable ? (
                                <button
                                  type="button"
                                  className="directory-action-button button-secondary button-compact"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void onOpenDirectoryEntryDiff(item)
                                  }}
                                  disabled={directoryOpenBusyPath === item.relativePath}
                                >
                                  {directoryOpenBusyPath === item.relativePath ? 'Opening...' : 'Open diff'}
                                </button>
                              ) : (
                                <span className="directory-action-reason muted">{actionReason ?? '—'}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                {hasMoreListItems ? (
                  <div className="result-load-more">
                    <button
                      type="button"
                      className="button-secondary button-compact"
                      onClick={() => setVisibleListRows((prev) => prev + DEFAULT_DIRECTORY_VISIBLE_ROWS)}
                    >
                      Show more ({sortedDirectoryItems.length - visibleListItems.length} remaining)
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="directory-tree-wrap">
                {visibleTreeItems.length === 0 ? (
                  <div className="muted">No entries to show.</div>
                ) : (
                  <div className="directory-tree" role="tree">
                    {visibleTreeItems.map(({ node, depth }) => {
                      const openable = canOpenDirectoryItem(node.item)
                      const enterable = node.isDir && node.item.status !== 'type-mismatch'
                      const actionReason = getDirectoryItemActionReason(node.item)
                      const selected = node.path === selectedDirectoryItemPath
                      const loadingNode = directoryTreeLoadingPath === node.path

                      return (
                        <div
                          key={node.path}
                          role="treeitem"
                          aria-expanded={node.isDir ? !!node.expanded : undefined}
                          className={`directory-tree-row ${selected ? 'is-selected' : ''} ${
                            enterable || openable ? 'directory-row-clickable' : ''
                          }`}
                          onClick={() => onSelectDirectoryItemPath(node.path)}
                          onDoubleClick={() => void onDirectoryTreeRowDoubleClick(node)}
                        >
                          <div
                            className={`directory-tree-name ${node.isDir ? 'is-dir' : 'is-file'} ${
                              openable ? 'is-openable' : ''
                            }`}
                          >
                            <span
                              className="directory-tree-indent"
                              style={{ ['--tree-depth' as string]: depth }}
                              aria-hidden="true"
                            />
                            {enterable ? (
                              <button
                                type="button"
                                className="directory-tree-chevron"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void onToggleDirectoryTreeNode(node)
                                }}
                                aria-label={node.expanded ? 'Collapse directory' : 'Expand directory'}
                              >
                                {node.expanded ? (
                                  <IconChevronDown size={14} />
                                ) : (
                                  <IconChevronRight size={14} />
                                )}
                              </button>
                            ) : (
                              <span className="directory-tree-chevron-spacer" />
                            )}
                            {node.isDir ? <IconFolderOpen size={14} /> : <IconFile size={14} />}
                            <span className="directory-entry-path">{node.name}</span>
                            <span className="directory-tree-status directory-status-cell">
                              <StatusBadge tone={toneForDirectoryStatus(node.status)}>
                                {formatDirectoryStatusLabel(node.status)}
                              </StatusBadge>
                            </span>
                          </div>
                          <div className="directory-tree-secondary">
                            {formatDirectorySide(node.item.leftExists, node.item.leftKind, node.item.leftSize)} /{' '}
                            {formatDirectorySide(node.item.rightExists, node.item.rightKind, node.item.rightSize)}
                          </div>
                          <div className="directory-tree-action">
                            {enterable ? (
                              <button
                                type="button"
                                className="directory-action-button button-secondary button-compact"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void onToggleDirectoryTreeNode(node)
                                }}
                                disabled={loadingNode}
                              >
                                {loadingNode ? 'Loading...' : node.expanded ? 'Collapse' : 'Enter'}
                              </button>
                            ) : openable ? (
                              <button
                                type="button"
                                className="directory-action-button button-secondary button-compact"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void onOpenDirectoryEntryDiff(node.item)
                                }}
                                disabled={directoryOpenBusyPath === node.path}
                              >
                                {directoryOpenBusyPath === node.path ? 'Opening...' : 'Open diff'}
                              </button>
                            ) : (
                              <span className="directory-action-reason muted">{actionReason ?? '—'}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {hasMoreTreeItems ? (
                  <div className="result-load-more">
                    <button
                      type="button"
                      className="button-secondary button-compact"
                      onClick={() => setVisibleTreeRows((prev) => prev + DEFAULT_DIRECTORY_VISIBLE_ROWS)}
                    >
                      Show more ({flattenedDirectoryTreeRows.length - visibleTreeItems.length} remaining)
                    </button>
                  </div>
                ) : null}
              </div>
            )
          ) : (
            <pre className="result-output">(no directory result yet)</pre>
          )}
        </div>

        {shouldShowDirectoryDetail ? (
          <div className="directory-detail-pane directory-detail-card">
            <div className="directory-detail-header">
              <span className="directory-entry-path directory-detail-title">
                {selectedDirectoryItemForDetail.relativePath || '(root)'}
              </span>
              <StatusBadge tone={toneForDirectoryStatus(selectedDirectoryItemForDetail.status)}>
                {formatDirectoryStatusLabel(selectedDirectoryItemForDetail.status)}
              </StatusBadge>
            </div>
            <div className="directory-detail-grid">
              <div className="directory-detail-label">Left path</div>
              <div className="directory-entry-path">{selectedDirectoryItemForDetail.leftPath || '(missing)'}</div>
              <div className="directory-detail-label">Right path</div>
              <div className="directory-entry-path">{selectedDirectoryItemForDetail.rightPath || '(missing)'}</div>
              <div className="directory-detail-label">Mode hint</div>
              <div>{selectedDirectoryItemForDetail.diffModeHint}</div>
              {selectedDirectoryItemForDetail.message ? (
                <>
                  <div className="directory-detail-label">Message</div>
                  <div>{selectedDirectoryItemForDetail.message}</div>
                </>
              ) : null}
            </div>
            <div className="directory-detail-action">
              {selectedDirectoryItemForDetail.isDir &&
              selectedDirectoryItemForDetail.status !== 'type-mismatch' ? (
                <button
                  type="button"
                  className="directory-action-button button-secondary button-compact"
                  onClick={() => void onNavigateDirectoryPath(selectedDirectoryItemForDetail.relativePath)}
                  disabled={
                    loading || directoryTreeLoadingPath === selectedDirectoryItemForDetail.relativePath
                  }
                >
                  Enter directory
                </button>
              ) : canOpenDirectoryItem(selectedDirectoryItemForDetail) ? (
                <button
                  type="button"
                  className="directory-action-button button-secondary button-compact"
                  onClick={() => void onOpenDirectoryEntryDiff(selectedDirectoryItemForDetail)}
                  disabled={directoryOpenBusyPath === selectedDirectoryItemForDetail.relativePath}
                >
                  {directoryOpenBusyPath === selectedDirectoryItemForDetail.relativePath
                    ? 'Opening...'
                    : 'Open diff'}
                </button>
              ) : (
                <div className="muted">{detailActionReason}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}
