import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CompareFoldersRequest,
  CompareFoldersResponse,
  FolderCompareItem,
} from '../../types'
import { usePersistedState } from '../../usePersistedState'
import {
  buildFolderBreadcrumbs,
  filterFolderItemsByQuickFilter,
  filterFolderTreeNodesByQuickFilter,
  flattenFolderTreeRows,
  folderItemsToTreeNodes,
  folderStatusSortRank,
  formatFolderSide,
  toggleFolderSort,
  type FolderQuickFilter,
  type FolderSortDirection,
  type FolderSortKey,
  type FolderTreeNode,
  type FolderViewMode,
} from './folderTree'

type UseDirectoryCompareViewStateOptions = {
  folderResult: CompareFoldersResponse | null
  folderLeftRoot: string
  folderRightRoot: string
  folderNameFilter: string
  folderCurrentPath: string
  compareFolders?: (req: CompareFoldersRequest) => Promise<CompareFoldersResponse>
  onFolderTreeLoadError?: (error: unknown) => void
}

const EMPTY_FOLDER_QUICK_FILTER_COUNTS: Record<FolderQuickFilter, number> = {
  all: 0,
  changed: 0,
  'left-only': 0,
  'right-only': 0,
  'type-mismatch': 0,
  error: 0,
  same: 0,
}

function sortFolderItemsForList(
  items: FolderCompareItem[],
  sortKey: FolderSortKey,
  sortDirection: FolderSortDirection,
): FolderCompareItem[] {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1

  return [...items].sort((left, right) => {
    if (sortKey === 'name') {
      if (left.isDir !== right.isDir) {
        return left.isDir ? -1 : 1
      }
      const comparedName = left.name.localeCompare(right.name, undefined, {
        sensitivity: 'base',
      })
      if (comparedName !== 0) {
        return comparedName * directionMultiplier
      }
      return left.relativePath.localeCompare(right.relativePath, undefined, {
        sensitivity: 'base',
      })
    }

    if (sortKey === 'status') {
      const rankDiff = folderStatusSortRank(left.status) - folderStatusSortRank(right.status)
      if (rankDiff !== 0) {
        return rankDiff * directionMultiplier
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    }

    if (sortKey === 'left') {
      const compared = formatFolderSide(left.leftExists, left.leftKind, left.leftSize).localeCompare(
        formatFolderSide(right.leftExists, right.leftKind, right.leftSize),
        undefined,
        { sensitivity: 'base' },
      )
      if (compared !== 0) {
        return compared * directionMultiplier
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    }

    const compared = formatFolderSide(left.rightExists, left.rightKind, left.rightSize).localeCompare(
      formatFolderSide(right.rightExists, right.rightKind, right.rightSize),
      undefined,
      { sensitivity: 'base' },
    )
    if (compared !== 0) {
      return compared * directionMultiplier
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

function updateTreeNodes(
  nodes: FolderTreeNode[],
  path: string,
  updater: (node: FolderTreeNode) => FolderTreeNode,
): FolderTreeNode[] {
  return nodes.map((node) => {
    if (node.path === path) {
      return updater(node)
    }
    if (!node.children || node.children.length === 0) {
      return node
    }
    return {
      ...node,
      children: updateTreeNodes(node.children, path, updater),
    }
  })
}

export function useDirectoryCompareViewState({
  folderResult,
  folderLeftRoot,
  folderRightRoot,
  folderNameFilter,
  folderCurrentPath,
  compareFolders,
  onFolderTreeLoadError,
}: UseDirectoryCompareViewStateOptions) {
  const [folderQuickFilter, setFolderQuickFilter] = useState<FolderQuickFilter>('all')
  const [selectedFolderItemPath, setSelectedFolderItemPath] = useState('')
  const [folderSortKey, setFolderSortKey] = useState<FolderSortKey>('name')
  const [folderSortDirection, setFolderSortDirection] = useState<FolderSortDirection>('asc')
  const [folderViewMode, setFolderViewMode] = usePersistedState<FolderViewMode>(
    'xdiff.desktop.folderViewMode',
    'list',
    (value): value is FolderViewMode => value === 'list' || value === 'tree',
  )
  const [folderTreeRoots, setFolderTreeRoots] = useState<FolderTreeNode[]>([])
  const [folderExpandedPaths, setFolderExpandedPaths] = useState<string[]>([])
  const [folderTreeLoadingPath, setFolderTreeLoadingPath] = useState('')
  const folderTreeCacheRef = useRef<Record<string, FolderCompareItem[]>>({})

  const folderItems = folderResult?.items ?? []
  const filteredFolderItems = useMemo(
    () => filterFolderItemsByQuickFilter(folderItems, folderQuickFilter),
    [folderItems, folderQuickFilter],
  )
  const sortedFolderItems = useMemo(
    () => sortFolderItemsForList(filteredFolderItems, folderSortKey, folderSortDirection),
    [filteredFolderItems, folderSortDirection, folderSortKey],
  )
  const selectedFolderItem = useMemo(
    () => sortedFolderItems.find((item) => item.relativePath === selectedFolderItemPath) ?? null,
    [sortedFolderItems, selectedFolderItemPath],
  )
  const filteredFolderTreeRoots = useMemo(
    () => filterFolderTreeNodesByQuickFilter(folderTreeRoots, folderQuickFilter),
    [folderTreeRoots, folderQuickFilter],
  )
  const flattenedFolderTreeRows = useMemo(
    () => flattenFolderTreeRows(filteredFolderTreeRoots),
    [filteredFolderTreeRoots],
  )
  const selectedFolderTreeItem = useMemo(
    () =>
      flattenedFolderTreeRows.find((row) => row.node.path === selectedFolderItemPath)?.node.item ??
      null,
    [flattenedFolderTreeRows, selectedFolderItemPath],
  )
  const selectedFolderItemForDetail =
    folderViewMode === 'tree' ? selectedFolderTreeItem : selectedFolderItem
  const folderQuickFilterCounts = useMemo(
    () => ({
      all: folderResult?.currentSummary.total ?? EMPTY_FOLDER_QUICK_FILTER_COUNTS.all,
      changed: folderResult?.currentSummary.changed ?? EMPTY_FOLDER_QUICK_FILTER_COUNTS.changed,
      'left-only':
        folderResult?.currentSummary.leftOnly ?? EMPTY_FOLDER_QUICK_FILTER_COUNTS['left-only'],
      'right-only':
        folderResult?.currentSummary.rightOnly ?? EMPTY_FOLDER_QUICK_FILTER_COUNTS['right-only'],
      'type-mismatch':
        folderResult?.currentSummary.typeMismatch ??
        EMPTY_FOLDER_QUICK_FILTER_COUNTS['type-mismatch'],
      error: folderResult?.currentSummary.error ?? EMPTY_FOLDER_QUICK_FILTER_COUNTS.error,
      same: folderResult?.currentSummary.same ?? EMPTY_FOLDER_QUICK_FILTER_COUNTS.same,
    }),
    [folderResult],
  )
  const folderBreadcrumbs = useMemo(
    () => buildFolderBreadcrumbs(folderResult?.currentPath ?? folderCurrentPath),
    [folderResult?.currentPath, folderCurrentPath],
  )

  useEffect(() => {
    if (sortedFolderItems.length === 0) {
      if (folderViewMode === 'list' && selectedFolderItemPath !== '') {
        setSelectedFolderItemPath('')
      }
      return
    }
    if (folderViewMode !== 'list') {
      return
    }
    const hasSelection = sortedFolderItems.some(
      (item) => item.relativePath === selectedFolderItemPath,
    )
    if (!hasSelection) {
      setSelectedFolderItemPath(sortedFolderItems[0].relativePath)
    }
  }, [folderViewMode, sortedFolderItems, selectedFolderItemPath])

  useEffect(() => {
    if (folderViewMode !== 'tree') {
      return
    }
    if (flattenedFolderTreeRows.length === 0) {
      if (selectedFolderItemPath !== '') {
        setSelectedFolderItemPath('')
      }
      return
    }
    const hasSelection = flattenedFolderTreeRows.some(
      (row) => row.node.path === selectedFolderItemPath,
    )
    if (!hasSelection) {
      setSelectedFolderItemPath(flattenedFolderTreeRows[0].node.path)
    }
  }, [folderViewMode, flattenedFolderTreeRows, selectedFolderItemPath])

  useEffect(() => {
    setFolderTreeRoots((prevRoots) => {
      const previousByPath = new Map(prevRoots.map((node) => [node.path, node]))
      return folderItemsToTreeNodes(folderItems).map((node) => {
        const previous = previousByPath.get(node.path)
        if (!previous) {
          return {
            ...node,
            expanded: folderExpandedPaths.includes(node.path),
          }
        }
        return {
          ...node,
          children: previous.children,
          loaded: previous.loaded,
          expanded: folderExpandedPaths.includes(node.path),
        }
      })
    })
    folderTreeCacheRef.current[''] = folderItems
  }, [folderItems, folderExpandedPaths])

  useEffect(() => {
    folderTreeCacheRef.current = {}
    setFolderTreeRoots([])
    setFolderExpandedPaths([])
  }, [folderLeftRoot, folderRightRoot, folderNameFilter])

  const loadFolderChildren = async (relativePath: string): Promise<FolderCompareItem[]> => {
    const cached = folderTreeCacheRef.current[relativePath]
    if (cached) {
      return cached
    }

    if (!compareFolders) {
      throw new Error('Wails bridge not available (CompareFolders)')
    }

    const res = await compareFolders({
      leftRoot: folderLeftRoot,
      rightRoot: folderRightRoot,
      currentPath: relativePath,
      recursive: true,
      showSame: true,
      nameFilter: folderNameFilter,
    } satisfies CompareFoldersRequest)

    if (res.error) {
      throw new Error(res.error)
    }

    folderTreeCacheRef.current[relativePath] = res.items
    return res.items
  }

  const expandFolderTreeNode = async (path: string) => {
    if (!folderLeftRoot || !folderRightRoot) {
      return
    }

    setFolderTreeLoadingPath(path)

    try {
      const items = await loadFolderChildren(path)
      const childNodes = folderItemsToTreeNodes(items)

      setFolderTreeRoots((prev) =>
        updateTreeNodes(prev, path, (node) => ({
          ...node,
          expanded: true,
          loaded: true,
          children: childNodes,
        })),
      )
      setFolderExpandedPaths((prev) => (prev.includes(path) ? prev : [...prev, path]))
    } catch (error) {
      onFolderTreeLoadError?.(error)
    } finally {
      setFolderTreeLoadingPath('')
    }
  }

  const collapseFolderTreeNode = (path: string) => {
    setFolderTreeRoots((prev) =>
      updateTreeNodes(prev, path, (node) => ({
        ...node,
        expanded: false,
      })),
    )
    setFolderExpandedPaths((prev) => prev.filter((entry) => entry !== path))
  }

  const toggleFolderTreeNode = async (node: FolderTreeNode) => {
    if (!node.isDir) {
      return
    }
    if (node.expanded) {
      collapseFolderTreeNode(node.path)
      return
    }
    await expandFolderTreeNode(node.path)
  }

  const applyFolderSort = (key: FolderSortKey) => {
    const next = toggleFolderSort(key, folderSortKey, folderSortDirection)
    setFolderSortKey(next.key)
    setFolderSortDirection(next.dir)
  }

  const resetFolderNavigationState = () => {
    setFolderQuickFilter('all')
    setSelectedFolderItemPath('')
  }

  return {
    folderQuickFilter,
    setFolderQuickFilter,
    folderSortKey,
    folderSortDirection,
    applyFolderSort,
    folderViewMode,
    setFolderViewMode,
    selectedFolderItemPath,
    setSelectedFolderItemPath,
    folderTreeLoadingPath,
    sortedFolderItems,
    flattenedFolderTreeRows,
    selectedFolderItem,
    selectedFolderItemForDetail,
    folderQuickFilterCounts,
    folderBreadcrumbs,
    toggleFolderTreeNode,
    resetFolderNavigationState,
  }
}
