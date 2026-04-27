import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  DiffDirectoriesRequest,
  DiffDirectoriesResponse,
  DirectoryDiffItem,
} from '../../types'
import { usePersistedState } from '../../usePersistedState'
import {
  buildDirectoryBreadcrumbs,
  filterDirectoryItemsByQuickFilter,
  filterDirectoryTreeNodesByQuickFilter,
  flattenDirectoryTreeRows,
  directoryItemsToTreeNodes,
  directoryStatusSortRank,
  formatDirectorySide,
  toggleDirectorySort,
  type DirectoryQuickFilter,
  type DirectorySortDirection,
  type DirectorySortKey,
  type DirectoryTreeNode,
  type DirectoryViewMode,
} from './directoryTree'

type UseDirectoryDiffViewStateOptions = {
  directoryResult: DiffDirectoriesResponse | null
  directoryLeftRoot: string
  directoryRightRoot: string
  directoryNameFilter: string
  directoryCurrentPath: string
  diffDirectories?: (req: DiffDirectoriesRequest) => Promise<DiffDirectoriesResponse>
  onDirectoryTreeLoadError?: (error: unknown) => void
}

const EMPTY_DIRECTORY_QUICK_FILTER_COUNTS: Record<DirectoryQuickFilter, number> = {
  all: 0,
  changed: 0,
  'left-only': 0,
  'right-only': 0,
  'type-mismatch': 0,
  error: 0,
  same: 0,
}

function sortDirectoryItemsForList(
  items: DirectoryDiffItem[],
  sortKey: DirectorySortKey,
  sortDirection: DirectorySortDirection,
): DirectoryDiffItem[] {
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
      const rankDiff = directoryStatusSortRank(left.status) - directoryStatusSortRank(right.status)
      if (rankDiff !== 0) {
        return rankDiff * directionMultiplier
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    }

    if (sortKey === 'left') {
      const compared = formatDirectorySide(left.leftExists, left.leftKind, left.leftSize).localeCompare(
        formatDirectorySide(right.leftExists, right.leftKind, right.leftSize),
        undefined,
        { sensitivity: 'base' },
      )
      if (compared !== 0) {
        return compared * directionMultiplier
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    }

    const compared = formatDirectorySide(left.rightExists, left.rightKind, left.rightSize).localeCompare(
      formatDirectorySide(right.rightExists, right.rightKind, right.rightSize),
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
  nodes: DirectoryTreeNode[],
  path: string,
  updater: (node: DirectoryTreeNode) => DirectoryTreeNode,
): DirectoryTreeNode[] {
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

export function useDirectoryDiffViewState({
  directoryResult,
  directoryLeftRoot,
  directoryRightRoot,
  directoryNameFilter,
  directoryCurrentPath,
  diffDirectories,
  onDirectoryTreeLoadError,
}: UseDirectoryDiffViewStateOptions) {
  const [directoryQuickFilter, setDirectoryQuickFilter] = useState<DirectoryQuickFilter>('all')
  const [selectedDirectoryItemPath, setSelectedDirectoryItemPath] = useState('')
  const [directorySortKey, setDirectorySortKey] = useState<DirectorySortKey>('name')
  const [directorySortDirection, setDirectorySortDirection] = useState<DirectorySortDirection>('asc')
  const [directoryViewMode, setDirectoryViewMode] = usePersistedState<DirectoryViewMode>(
    'xdiff.desktop.directoryViewMode',
    'list',
    (value): value is DirectoryViewMode => value === 'list' || value === 'tree',
  )
  const [directoryTreeRoots, setDirectoryTreeRoots] = useState<DirectoryTreeNode[]>([])
  const [directoryExpandedPaths, setDirectoryExpandedPaths] = useState<string[]>([])
  const [directoryTreeLoadingPath, setDirectoryTreeLoadingPath] = useState('')
  const directoryTreeCacheRef = useRef<Record<string, DirectoryDiffItem[]>>({})

  const directoryItems = directoryResult?.items ?? []
  const filteredDirectoryItems = useMemo(
    () => filterDirectoryItemsByQuickFilter(directoryItems, directoryQuickFilter),
    [directoryItems, directoryQuickFilter],
  )
  const sortedDirectoryItems = useMemo(
    () => sortDirectoryItemsForList(filteredDirectoryItems, directorySortKey, directorySortDirection),
    [filteredDirectoryItems, directorySortDirection, directorySortKey],
  )
  const selectedDirectoryItem = useMemo(
    () => sortedDirectoryItems.find((item) => item.relativePath === selectedDirectoryItemPath) ?? null,
    [sortedDirectoryItems, selectedDirectoryItemPath],
  )
  const filteredDirectoryTreeRoots = useMemo(
    () => filterDirectoryTreeNodesByQuickFilter(directoryTreeRoots, directoryQuickFilter),
    [directoryTreeRoots, directoryQuickFilter],
  )
  const flattenedDirectoryTreeRows = useMemo(
    () => flattenDirectoryTreeRows(filteredDirectoryTreeRoots),
    [filteredDirectoryTreeRoots],
  )
  const selectedDirectoryTreeItem = useMemo(
    () =>
      flattenedDirectoryTreeRows.find((row) => row.node.path === selectedDirectoryItemPath)?.node.item ??
      null,
    [flattenedDirectoryTreeRows, selectedDirectoryItemPath],
  )
  const selectedDirectoryItemForDetail =
    directoryViewMode === 'tree' ? selectedDirectoryTreeItem : selectedDirectoryItem
  const directoryQuickFilterCounts = useMemo(
    () => ({
      all: directoryResult?.currentSummary.total ?? EMPTY_DIRECTORY_QUICK_FILTER_COUNTS.all,
      changed: directoryResult?.currentSummary.changed ?? EMPTY_DIRECTORY_QUICK_FILTER_COUNTS.changed,
      'left-only':
        directoryResult?.currentSummary.leftOnly ?? EMPTY_DIRECTORY_QUICK_FILTER_COUNTS['left-only'],
      'right-only':
        directoryResult?.currentSummary.rightOnly ?? EMPTY_DIRECTORY_QUICK_FILTER_COUNTS['right-only'],
      'type-mismatch':
        directoryResult?.currentSummary.typeMismatch ??
        EMPTY_DIRECTORY_QUICK_FILTER_COUNTS['type-mismatch'],
      error: directoryResult?.currentSummary.error ?? EMPTY_DIRECTORY_QUICK_FILTER_COUNTS.error,
      same: directoryResult?.currentSummary.same ?? EMPTY_DIRECTORY_QUICK_FILTER_COUNTS.same,
    }),
    [directoryResult],
  )
  const directoryBreadcrumbs = useMemo(
    () => buildDirectoryBreadcrumbs(directoryResult?.currentPath ?? directoryCurrentPath),
    [directoryResult?.currentPath, directoryCurrentPath],
  )

  useEffect(() => {
    if (sortedDirectoryItems.length === 0) {
      if (directoryViewMode === 'list' && selectedDirectoryItemPath !== '') {
        setSelectedDirectoryItemPath('')
      }
      return
    }
    if (directoryViewMode !== 'list') {
      return
    }
    const hasSelection = sortedDirectoryItems.some(
      (item) => item.relativePath === selectedDirectoryItemPath,
    )
    if (!hasSelection) {
      setSelectedDirectoryItemPath(sortedDirectoryItems[0].relativePath)
    }
  }, [directoryViewMode, sortedDirectoryItems, selectedDirectoryItemPath])

  useEffect(() => {
    if (directoryViewMode !== 'tree') {
      return
    }
    if (flattenedDirectoryTreeRows.length === 0) {
      if (selectedDirectoryItemPath !== '') {
        setSelectedDirectoryItemPath('')
      }
      return
    }
    const hasSelection = flattenedDirectoryTreeRows.some(
      (row) => row.node.path === selectedDirectoryItemPath,
    )
    if (!hasSelection) {
      setSelectedDirectoryItemPath(flattenedDirectoryTreeRows[0].node.path)
    }
  }, [directoryViewMode, flattenedDirectoryTreeRows, selectedDirectoryItemPath])

  useEffect(() => {
    setDirectoryTreeRoots((prevRoots) => {
      const previousByPath = new Map(prevRoots.map((node) => [node.path, node]))
      return directoryItemsToTreeNodes(directoryItems).map((node) => {
        const previous = previousByPath.get(node.path)
        if (!previous) {
          return {
            ...node,
            expanded: directoryExpandedPaths.includes(node.path),
          }
        }
        return {
          ...node,
          children: previous.children,
          loaded: previous.loaded,
          expanded: directoryExpandedPaths.includes(node.path),
        }
      })
    })
    directoryTreeCacheRef.current[''] = directoryItems
  }, [directoryItems, directoryExpandedPaths])

  useEffect(() => {
    directoryTreeCacheRef.current = {}
    setDirectoryTreeRoots([])
    setDirectoryExpandedPaths([])
  }, [directoryLeftRoot, directoryRightRoot, directoryNameFilter])

  const loadDirectoryChildren = async (relativePath: string): Promise<DirectoryDiffItem[]> => {
    const cached = directoryTreeCacheRef.current[relativePath]
    if (cached) {
      return cached
    }

    if (!diffDirectories) {
      throw new Error('Wails bridge not available (DiffDirectories)')
    }

    const res = await diffDirectories({
      leftRoot: directoryLeftRoot,
      rightRoot: directoryRightRoot,
      currentPath: relativePath,
      recursive: true,
      showSame: true,
      nameFilter: directoryNameFilter,
    } satisfies DiffDirectoriesRequest)

    if (res.error) {
      throw new Error(res.error)
    }

    directoryTreeCacheRef.current[relativePath] = res.items
    return res.items
  }

  const expandDirectoryTreeNode = async (path: string) => {
    if (!directoryLeftRoot || !directoryRightRoot) {
      return
    }

    setDirectoryTreeLoadingPath(path)

    try {
      const items = await loadDirectoryChildren(path)
      const childNodes = directoryItemsToTreeNodes(items)

      setDirectoryTreeRoots((prev) =>
        updateTreeNodes(prev, path, (node) => ({
          ...node,
          expanded: true,
          loaded: true,
          children: childNodes,
        })),
      )
      setDirectoryExpandedPaths((prev) => (prev.includes(path) ? prev : [...prev, path]))
    } catch (error) {
      onDirectoryTreeLoadError?.(error)
    } finally {
      setDirectoryTreeLoadingPath('')
    }
  }

  const collapseDirectoryTreeNode = (path: string) => {
    setDirectoryTreeRoots((prev) =>
      updateTreeNodes(prev, path, (node) => ({
        ...node,
        expanded: false,
      })),
    )
    setDirectoryExpandedPaths((prev) => prev.filter((entry) => entry !== path))
  }

  const toggleDirectoryTreeNode = async (node: DirectoryTreeNode) => {
    if (!node.isDir) {
      return
    }
    if (node.expanded) {
      collapseDirectoryTreeNode(node.path)
      return
    }
    await expandDirectoryTreeNode(node.path)
  }

  const applyDirectorySort = (key: DirectorySortKey) => {
    const next = toggleDirectorySort(key, directorySortKey, directorySortDirection)
    setDirectorySortKey(next.key)
    setDirectorySortDirection(next.dir)
  }

  const resetDirectoryNavigationState = () => {
    setDirectoryQuickFilter('all')
    setSelectedDirectoryItemPath('')
  }

  return {
    directoryQuickFilter,
    setDirectoryQuickFilter,
    directorySortKey,
    directorySortDirection,
    applyDirectorySort,
    directoryViewMode,
    setDirectoryViewMode,
    selectedDirectoryItemPath,
    setSelectedDirectoryItemPath,
    directoryTreeLoadingPath,
    sortedDirectoryItems,
    flattenedDirectoryTreeRows,
    selectedDirectoryItem,
    selectedDirectoryItemForDetail,
    directoryQuickFilterCounts,
    directoryBreadcrumbs,
    toggleDirectoryTreeNode,
    resetDirectoryNavigationState,
  }
}
