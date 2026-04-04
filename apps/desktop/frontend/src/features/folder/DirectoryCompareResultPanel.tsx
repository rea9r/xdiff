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
import type { CompareFoldersResponse, FolderCompareItem } from '../../types'
import { SectionCard } from '../../ui/SectionCard'
import { StatusBadge } from '../../ui/StatusBadge'
import {
  canOpenFolderItem,
  folderQuickFilterLabel,
  formatFolderKindLabel,
  formatFolderSide,
  formatFolderStatusLabel,
  getFolderItemActionReason,
  toneForFolderStatus,
  type FolderQuickFilter,
  type FolderSortDirection,
  type FolderSortKey,
  type FolderTreeNode,
  type FolderTreeRow,
  type FolderViewMode,
} from './folderTree'

const QUICK_FILTERS: FolderQuickFilter[] = [
  'all',
  'changed',
  'left-only',
  'right-only',
  'type-mismatch',
  'error',
  'same',
]
const DEFAULT_FOLDER_VISIBLE_ROWS = 300

export type DirectoryCompareResultPanelProps = {
  folderResult: CompareFoldersResponse | null
  folderStatus: string
  folderLeftRoot: string
  folderRightRoot: string
  folderNameFilter: string
  folderCurrentPath: string
  folderViewMode: FolderViewMode
  folderQuickFilter: FolderQuickFilter
  folderQuickFilterCounts: Record<FolderQuickFilter, number>
  folderSortKey: FolderSortKey
  folderSortDirection: FolderSortDirection
  folderOpenBusyPath: string
  folderTreeLoadingPath: string
  selectedFolderItemPath: string
  sortedFolderItems: FolderCompareItem[]
  flattenedFolderTreeRows: FolderTreeRow[]
  selectedFolderItemForDetail: FolderCompareItem | null
  folderBreadcrumbs: Array<{ label: string; path: string }>
  loading: boolean
  onBrowseFolderRoot: (target: 'left' | 'right') => void | Promise<void>
  onSetFolderNameFilter: (value: string) => void
  onSetFolderViewMode: (viewMode: FolderViewMode) => void
  onSetFolderQuickFilter: (filter: FolderQuickFilter) => void
  onSelectFolderItemPath: (path: string) => void
  onNavigateFolderPath: (path: string) => void | Promise<void>
  onApplyFolderSort: (key: FolderSortKey) => void
  onOpenFolderEntryDiff: (item: FolderCompareItem) => void | Promise<void>
  onToggleFolderTreeNode: (node: FolderTreeNode) => void | Promise<void>
  onFolderRowDoubleClick: (item: FolderCompareItem) => void | Promise<void>
  onFolderTreeRowDoubleClick: (node: FolderTreeNode) => void | Promise<void>
  onFolderTableKeyDown: KeyboardEventHandler<HTMLDivElement>
}

function FolderSortIndicator({
  active,
  direction,
}: {
  active: boolean
  direction: FolderSortDirection
}) {
  if (!active) {
    return null
  }

  return <span className="folder-sort-indicator">{direction === 'asc' ? '▲' : '▼'}</span>
}

export function DirectoryCompareResultPanel({
  folderResult,
  folderStatus,
  folderLeftRoot,
  folderRightRoot,
  folderNameFilter,
  folderCurrentPath,
  folderViewMode,
  folderQuickFilter,
  folderQuickFilterCounts,
  folderSortKey,
  folderSortDirection,
  folderOpenBusyPath,
  folderTreeLoadingPath,
  selectedFolderItemPath,
  sortedFolderItems,
  flattenedFolderTreeRows,
  selectedFolderItemForDetail,
  folderBreadcrumbs,
  loading,
  onBrowseFolderRoot,
  onSetFolderNameFilter,
  onSetFolderViewMode,
  onSetFolderQuickFilter,
  onSelectFolderItemPath,
  onNavigateFolderPath,
  onApplyFolderSort,
  onOpenFolderEntryDiff,
  onToggleFolderTreeNode,
  onFolderRowDoubleClick,
  onFolderTreeRowDoubleClick,
  onFolderTableKeyDown,
}: DirectoryCompareResultPanelProps) {
  const [visibleListRows, setVisibleListRows] = useState(DEFAULT_FOLDER_VISIBLE_ROWS)
  const [visibleTreeRows, setVisibleTreeRows] = useState(DEFAULT_FOLDER_VISIBLE_ROWS)

  useEffect(() => {
    setVisibleListRows(DEFAULT_FOLDER_VISIBLE_ROWS)
    setVisibleTreeRows(DEFAULT_FOLDER_VISIBLE_ROWS)
  }, [
    folderCurrentPath,
    folderNameFilter,
    folderQuickFilter,
    folderSortDirection,
    folderSortKey,
    folderViewMode,
    folderResult?.currentPath,
  ])

  const detailActionReason = selectedFolderItemForDetail
    ? getFolderItemActionReason(selectedFolderItemForDetail)
    : null
  const currentPath = folderResult?.currentPath ?? folderCurrentPath
  const visibleCount =
    folderViewMode === 'tree' ? flattenedFolderTreeRows.length : sortedFolderItems.length
  const canCompareFolders = !!folderLeftRoot && !!folderRightRoot
  const shouldShowFolderDetail =
    folderViewMode === 'list' && !!selectedFolderItemForDetail
  const selectedListIndex = useMemo(
    () => sortedFolderItems.findIndex((item) => item.relativePath === selectedFolderItemPath),
    [selectedFolderItemPath, sortedFolderItems],
  )
  const selectedTreeIndex = useMemo(
    () => flattenedFolderTreeRows.findIndex((row) => row.node.path === selectedFolderItemPath),
    [flattenedFolderTreeRows, selectedFolderItemPath],
  )
  const effectiveVisibleListRows =
    selectedListIndex >= 0 ? Math.max(visibleListRows, selectedListIndex + 1) : visibleListRows
  const effectiveVisibleTreeRows =
    selectedTreeIndex >= 0 ? Math.max(visibleTreeRows, selectedTreeIndex + 1) : visibleTreeRows
  const visibleListItems = useMemo(
    () => sortedFolderItems.slice(0, effectiveVisibleListRows),
    [effectiveVisibleListRows, sortedFolderItems],
  )
  const visibleTreeItems = useMemo(
    () => flattenedFolderTreeRows.slice(0, effectiveVisibleTreeRows),
    [effectiveVisibleTreeRows, flattenedFolderTreeRows],
  )
  const hasMoreListItems = visibleListItems.length < sortedFolderItems.length
  const hasMoreTreeItems = visibleTreeItems.length < flattenedFolderTreeRows.length

  return (
    <SectionCard>
      <div className={`folder-result-shell ${folderViewMode === 'tree' ? 'is-tree-mode' : ''}`.trim()}>
        <div className="folder-result-header">
          <div className="folder-header-bar">
            <div className="folder-header-context">
              <span className="folder-title">Directory Compare</span>
              <div className="folder-current-path" aria-label="Current path">
                {folderBreadcrumbs.map((crumb, index) => (
                  <Fragment key={crumb.path || 'root'}>
                    {crumb.path === currentPath ? (
                      <span className="folder-breadcrumb-current">{crumb.label}</span>
                    ) : (
                      <button
                        type="button"
                        className="folder-breadcrumb-link"
                        onClick={() => void onNavigateFolderPath(crumb.path)}
                        disabled={loading || !canCompareFolders}
                      >
                        {crumb.label}
                      </button>
                    )}
                    {index < folderBreadcrumbs.length - 1 ? (
                      <span className="folder-breadcrumb-sep">/</span>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="folder-root-bar">
            <div
              className="folder-root-field"
              onClick={() => void onBrowseFolderRoot('left')}
              role="button"
              tabIndex={loading ? -1 : 0}
              onKeyDown={(event) => {
                if (loading) {
                  return
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void onBrowseFolderRoot('left')
                }
              }}
            >
              <span className="folder-root-label">Left</span>
              <input
                className="folder-root-input"
                readOnly
                value={folderLeftRoot}
                placeholder="Select left directory"
                title={folderLeftRoot || 'Select left directory'}
              />
              <ActionIcon
                variant="default"
                size={24}
                aria-label="Pick left directory"
                onClick={(event) => {
                  event.stopPropagation()
                  void onBrowseFolderRoot('left')
                }}
                disabled={loading}
              >
                <IconFolderOpen size={14} />
              </ActionIcon>
            </div>
            <div
              className="folder-root-field"
              onClick={() => void onBrowseFolderRoot('right')}
              role="button"
              tabIndex={loading ? -1 : 0}
              onKeyDown={(event) => {
                if (loading) {
                  return
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void onBrowseFolderRoot('right')
                }
              }}
            >
              <span className="folder-root-label">Right</span>
              <input
                className="folder-root-input"
                readOnly
                value={folderRightRoot}
                placeholder="Select right directory"
                title={folderRightRoot || 'Select right directory'}
              />
              <ActionIcon
                variant="default"
                size={24}
                aria-label="Pick right directory"
                onClick={(event) => {
                  event.stopPropagation()
                  void onBrowseFolderRoot('right')
                }}
                disabled={loading}
              >
                <IconFolderOpen size={14} />
              </ActionIcon>
            </div>
          </div>

          {folderStatus ? <div className="muted">{folderStatus}</div> : null}
        </div>

        <div className="folder-quick-filters">
          <div className="folder-result-toolbar-left">
            <div className="folder-compact-summary">
              <span>{folderResult?.scannedSummary.total ?? 0} scanned</span>
              <span>{visibleCount} here</span>
            </div>
            <div className="folder-view-mode-toggle" role="tablist" aria-label="Directory view mode">
              <button
                type="button"
                className={`button-secondary button-compact ${
                  folderViewMode === 'list' ? 'folder-quick-filter-active' : ''
                }`}
                onClick={() => onSetFolderViewMode('list')}
                role="tab"
                aria-selected={folderViewMode === 'list'}
              >
                <IconList size={13} />
                List
              </button>
              <button
                type="button"
                className={`button-secondary button-compact ${
                  folderViewMode === 'tree' ? 'folder-quick-filter-active' : ''
                }`}
                onClick={() => onSetFolderViewMode('tree')}
                role="tab"
                aria-selected={folderViewMode === 'tree'}
              >
                <IconBinaryTree2 size={13} />
                Tree
              </button>
            </div>
          </div>
          <div className="folder-result-toolbar-right">
            {QUICK_FILTERS.map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                className={`button-secondary button-compact ${
                  folderQuickFilter === filterKey ? 'folder-quick-filter-active' : ''
                }`}
                onClick={() => onSetFolderQuickFilter(filterKey)}
              >
                {folderQuickFilterLabel(filterKey)} ({folderQuickFilterCounts[filterKey]})
              </button>
            ))}
            <input
              className="folder-name-filter-input"
              value={folderNameFilter}
              onChange={(event) => onSetFolderNameFilter(event.target.value)}
              placeholder="name filter"
            />
          </div>
        </div>

        <div className="folder-list-tree-viewport">
          {folderResult?.error ? (
            <pre className="result-output">{folderResult.error}</pre>
          ) : folderResult ? (
            folderViewMode === 'list' ? (
              <div
                className="folder-table-wrap"
                tabIndex={0}
                onKeyDown={onFolderTableKeyDown}
                onFocus={() => {
                  if (!selectedFolderItemPath && sortedFolderItems.length > 0) {
                    onSelectFolderItemPath(sortedFolderItems[0].relativePath)
                  }
                }}
              >
                <table className="folder-results-table">
                  <thead>
                    <tr>
                      <th className="folder-sortable-header" onClick={() => onApplyFolderSort('name')}>
                        Name
                        <FolderSortIndicator
                          active={folderSortKey === 'name'}
                          direction={folderSortDirection}
                        />
                      </th>
                      <th className="folder-sortable-header" onClick={() => onApplyFolderSort('status')}>
                        Status
                        <FolderSortIndicator
                          active={folderSortKey === 'status'}
                          direction={folderSortDirection}
                        />
                      </th>
                      <th className="folder-sortable-header" onClick={() => onApplyFolderSort('left')}>
                        Left
                        <FolderSortIndicator
                          active={folderSortKey === 'left'}
                          direction={folderSortDirection}
                        />
                      </th>
                      <th className="folder-sortable-header" onClick={() => onApplyFolderSort('right')}>
                        Right
                        <FolderSortIndicator
                          active={folderSortKey === 'right'}
                          direction={folderSortDirection}
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
                        const openable = canOpenFolderItem(item)
                        const enterable = item.isDir && item.status !== 'type-mismatch'
                        const actionReason = getFolderItemActionReason(item)
                        const selected = item.relativePath === selectedFolderItemPath

                        return (
                          <tr
                            key={item.relativePath}
                            className={[
                              selected ? 'folder-row-selected' : '',
                              enterable || openable ? 'folder-row-clickable' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => onSelectFolderItemPath(item.relativePath)}
                            onDoubleClick={() => void onFolderRowDoubleClick(item)}
                          >
                            <td>
                              <div
                                className={`folder-item-name ${enterable ? 'is-dir' : ''}`}
                                onClick={(event) => {
                                  if (!enterable) return
                                  event.stopPropagation()
                                  void onNavigateFolderPath(item.relativePath)
                                }}
                              >
                                {item.isDir ? <IconFolderOpen size={14} /> : <IconFile size={14} />}
                                <span
                                  className="folder-entry-path"
                                  title={`${item.leftPath || '(missing)'}\n${item.rightPath || '(missing)'}`}
                                >
                                  {item.name}
                                </span>
                              </div>
                              {item.relativePath !== item.name ? (
                                <div className="folder-entry-sub muted">{item.relativePath}</div>
                              ) : null}
                              {item.message ? (
                                <div className="folder-entry-sub muted">{item.message}</div>
                              ) : null}
                            </td>
                            <td className="folder-status-cell">
                              <StatusBadge tone={toneForFolderStatus(item.status)}>
                                {formatFolderStatusLabel(item.status)}
                              </StatusBadge>
                            </td>
                            <td>{formatFolderSide(item.leftExists, item.leftKind, item.leftSize)}</td>
                            <td>{formatFolderSide(item.rightExists, item.rightKind, item.rightSize)}</td>
                            <td>
                              {enterable ? (
                                <button
                                  type="button"
                                  className="folder-action-button button-secondary button-compact"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void onNavigateFolderPath(item.relativePath)
                                  }}
                                  disabled={loading}
                                >
                                  Enter
                                </button>
                              ) : openable ? (
                                <button
                                  type="button"
                                  className="folder-action-button button-secondary button-compact"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void onOpenFolderEntryDiff(item)
                                  }}
                                  disabled={folderOpenBusyPath === item.relativePath}
                                >
                                  {folderOpenBusyPath === item.relativePath ? 'Opening...' : 'Open diff'}
                                </button>
                              ) : (
                                <span className="folder-action-reason muted">{actionReason ?? '—'}</span>
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
                      onClick={() => setVisibleListRows((prev) => prev + DEFAULT_FOLDER_VISIBLE_ROWS)}
                    >
                      Show more ({sortedFolderItems.length - visibleListItems.length} remaining)
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="folder-tree-wrap">
                {visibleTreeItems.length === 0 ? (
                  <div className="muted">No entries to show.</div>
                ) : (
                  <div className="folder-tree" role="tree">
                    {visibleTreeItems.map(({ node, depth }) => {
                      const openable = canOpenFolderItem(node.item)
                      const enterable = node.isDir && node.item.status !== 'type-mismatch'
                      const actionReason = getFolderItemActionReason(node.item)
                      const selected = node.path === selectedFolderItemPath
                      const loadingNode = folderTreeLoadingPath === node.path

                      return (
                        <div
                          key={node.path}
                          role="treeitem"
                          aria-expanded={node.isDir ? !!node.expanded : undefined}
                          className={`folder-tree-row ${selected ? 'is-selected' : ''} ${
                            enterable || openable ? 'folder-row-clickable' : ''
                          }`}
                          onClick={() => onSelectFolderItemPath(node.path)}
                          onDoubleClick={() => void onFolderTreeRowDoubleClick(node)}
                        >
                          <div
                            className={`folder-tree-name ${node.isDir ? 'is-dir' : 'is-file'} ${
                              openable ? 'is-openable' : ''
                            }`}
                          >
                            <span
                              className="folder-tree-indent"
                              style={{ ['--tree-depth' as string]: depth }}
                              aria-hidden="true"
                            />
                            {enterable ? (
                              <button
                                type="button"
                                className="folder-tree-chevron"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void onToggleFolderTreeNode(node)
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
                              <span className="folder-tree-chevron-spacer" />
                            )}
                            {node.isDir ? <IconFolderOpen size={14} /> : <IconFile size={14} />}
                            <span className="folder-entry-path">{node.name}</span>
                            <span className="folder-tree-status folder-status-cell">
                              <StatusBadge tone={toneForFolderStatus(node.status)}>
                                {formatFolderStatusLabel(node.status)}
                              </StatusBadge>
                            </span>
                          </div>
                          <div className="folder-tree-secondary">
                            {formatFolderSide(node.item.leftExists, node.item.leftKind, node.item.leftSize)} /{' '}
                            {formatFolderSide(node.item.rightExists, node.item.rightKind, node.item.rightSize)}
                          </div>
                          <div className="folder-tree-action">
                            {enterable ? (
                              <button
                                type="button"
                                className="folder-action-button button-secondary button-compact"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void onToggleFolderTreeNode(node)
                                }}
                                disabled={loadingNode}
                              >
                                {loadingNode ? 'Loading...' : node.expanded ? 'Collapse' : 'Enter'}
                              </button>
                            ) : openable ? (
                              <button
                                type="button"
                                className="folder-action-button button-secondary button-compact"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void onOpenFolderEntryDiff(node.item)
                                }}
                                disabled={folderOpenBusyPath === node.path}
                              >
                                {folderOpenBusyPath === node.path ? 'Opening...' : 'Open diff'}
                              </button>
                            ) : (
                              <span className="folder-action-reason muted">{actionReason ?? '—'}</span>
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
                      onClick={() => setVisibleTreeRows((prev) => prev + DEFAULT_FOLDER_VISIBLE_ROWS)}
                    >
                      Show more ({flattenedFolderTreeRows.length - visibleTreeItems.length} remaining)
                    </button>
                  </div>
                ) : null}
              </div>
            )
          ) : (
            <pre className="result-output">(no directory result yet)</pre>
          )}
        </div>

        {shouldShowFolderDetail ? (
          <div className="folder-detail-pane folder-detail-card">
            <div className="folder-summary-title">Selected Entry</div>
            <div className="folder-detail-grid">
              <div className="folder-detail-label">Relative path</div>
              <div className="folder-entry-path">{selectedFolderItemForDetail.relativePath}</div>
              <div className="folder-detail-label">Status</div>
              <div className="folder-status-cell">
                <StatusBadge tone={toneForFolderStatus(selectedFolderItemForDetail.status)}>
                  {formatFolderStatusLabel(selectedFolderItemForDetail.status)}
                </StatusBadge>
              </div>
              <div className="folder-detail-label">Left path</div>
              <div className="folder-entry-path">{selectedFolderItemForDetail.leftPath || '(missing)'}</div>
              <div className="folder-detail-label">Right path</div>
              <div className="folder-entry-path">{selectedFolderItemForDetail.rightPath || '(missing)'}</div>
              <div className="folder-detail-label">Left kind</div>
              <div>{formatFolderKindLabel(selectedFolderItemForDetail.leftKind)}</div>
              <div className="folder-detail-label">Right kind</div>
              <div>{formatFolderKindLabel(selectedFolderItemForDetail.rightKind)}</div>
              <div className="folder-detail-label">Left size</div>
              <div>{selectedFolderItemForDetail.leftSize}</div>
              <div className="folder-detail-label">Right size</div>
              <div>{selectedFolderItemForDetail.rightSize}</div>
              <div className="folder-detail-label">Mode hint</div>
              <div>{selectedFolderItemForDetail.compareModeHint}</div>
              {selectedFolderItemForDetail.message ? (
                <>
                  <div className="folder-detail-label">Message</div>
                  <div>{selectedFolderItemForDetail.message}</div>
                </>
              ) : null}
            </div>
            <div className="folder-detail-action">
              {selectedFolderItemForDetail.isDir &&
              selectedFolderItemForDetail.status !== 'type-mismatch' ? (
                <button
                  type="button"
                  className="folder-action-button button-secondary button-compact"
                  onClick={() => void onNavigateFolderPath(selectedFolderItemForDetail.relativePath)}
                  disabled={
                    loading || folderTreeLoadingPath === selectedFolderItemForDetail.relativePath
                  }
                >
                  Enter directory
                </button>
              ) : canOpenFolderItem(selectedFolderItemForDetail) ? (
                <button
                  type="button"
                  className="folder-action-button button-secondary button-compact"
                  onClick={() => void onOpenFolderEntryDiff(selectedFolderItemForDetail)}
                  disabled={folderOpenBusyPath === selectedFolderItemForDetail.relativePath}
                >
                  {folderOpenBusyPath === selectedFolderItemForDetail.relativePath
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
