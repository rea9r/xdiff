import type { FolderCompareItem } from '../../types'

export type FolderQuickFilter =
  | 'all'
  | 'changed'
  | 'left-only'
  | 'right-only'
  | 'type-mismatch'
  | 'error'
  | 'same'

export type FolderSortKey = 'name' | 'status' | 'left' | 'right'

export type FolderSortDirection = 'asc' | 'desc'

export type FolderViewMode = 'list' | 'tree'

export type FolderTreeNode = {
  path: string
  name: string
  isDir: boolean
  status: FolderCompareItem['status']
  item: FolderCompareItem
  children?: FolderTreeNode[]
  loaded?: boolean
  expanded?: boolean
}

export type FolderTreeRow = {
  depth: number
  node: FolderTreeNode
}

export type FolderTreeBreadcrumb = {
  label: string
  path: string
}

export function toneForFolderStatus(
  status: FolderCompareItem['status'],
): 'default' | 'success' | 'warning' | 'danger' | 'accent' {
  if (status === 'same') return 'success'
  if (status === 'changed') return 'warning'
  if (status === 'left-only' || status === 'right-only') return 'accent'
  if (status === 'error' || status === 'type-mismatch') return 'danger'
  return 'default'
}

export function formatFolderStatusLabel(status: FolderCompareItem['status']): string {
  switch (status) {
    case 'same':
      return 'same'
    case 'changed':
      return 'changed'
    case 'left-only':
      return 'left only'
    case 'right-only':
      return 'right only'
    case 'type-mismatch':
      return 'type mismatch'
    case 'error':
      return 'error'
    default:
      return status
  }
}

export function canOpenFolderItem(entry: FolderCompareItem): boolean {
  return (
    entry.compareModeHint !== 'none' &&
    entry.leftExists &&
    entry.rightExists &&
    entry.leftKind === 'file' &&
    entry.rightKind === 'file'
  )
}

export function getFolderItemActionReason(entry: FolderCompareItem): string | null {
  if (canOpenFolderItem(entry)) {
    return null
  }

  if (!entry.leftExists) return 'Only on right'
  if (!entry.rightExists) return 'Only on left'
  if (entry.leftKind !== entry.rightKind) return 'Type mismatch'
  if (entry.isDir) return 'Directory item'
  if (entry.leftKind === 'dir' || entry.rightKind === 'dir') return 'Directory item'
  if (entry.compareModeHint === 'none') return 'No compare mode'
  return 'Not comparable'
}

export function folderQuickFilterLabel(filter: FolderQuickFilter): string {
  switch (filter) {
    case 'all':
      return 'All'
    case 'changed':
      return 'Changed'
    case 'left-only':
      return 'Left only'
    case 'right-only':
      return 'Right only'
    case 'type-mismatch':
      return 'Type mismatch'
    case 'error':
      return 'Errors'
    case 'same':
      return 'Same'
    default:
      return filter
  }
}

export function filterFolderItemsByQuickFilter(
  items: FolderCompareItem[],
  quickFilter: FolderQuickFilter,
): FolderCompareItem[] {
  if (quickFilter === 'all') {
    return items
  }
  return items.filter((item) => item.status === quickFilter)
}

export function toggleFolderSort(
  key: FolderSortKey,
  currentKey: FolderSortKey,
  currentDir: FolderSortDirection,
): { key: FolderSortKey; dir: FolderSortDirection } {
  if (key !== currentKey) {
    return { key, dir: 'asc' }
  }

  return { key, dir: currentDir === 'asc' ? 'desc' : 'asc' }
}

export function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function formatFolderSide(exists: boolean, kind: string, size: number): string {
  if (!exists || kind === 'missing') {
    return '—'
  }
  if (kind === 'dir') {
    return 'directory'
  }
  if (kind === 'file') {
    return size > 0 ? `file · ${formatBytes(size)}` : 'file'
  }
  return kind
}

export function formatFolderKindLabel(kind: FolderCompareItem['leftKind']): string {
  if (kind === 'dir') {
    return 'directory'
  }
  return kind
}

export function folderStatusSortRank(status: FolderCompareItem['status']): number {
  switch (status) {
    case 'changed':
      return 0
    case 'left-only':
      return 1
    case 'right-only':
      return 2
    case 'type-mismatch':
      return 3
    case 'error':
      return 4
    case 'same':
      return 5
    default:
      return 99
  }
}

function sortFolderItemsForTree(items: FolderCompareItem[]): FolderCompareItem[] {
  return [...items].sort((left, right) => {
    if (left.isDir !== right.isDir) {
      return left.isDir ? -1 : 1
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

export function folderItemsToTreeNodes(items: FolderCompareItem[]): FolderTreeNode[] {
  return sortFolderItemsForTree(items).map((item) => ({
    path: item.relativePath,
    name: item.name,
    isDir: item.isDir,
    status: item.status,
    item,
    children: item.isDir ? [] : undefined,
    loaded: !item.isDir,
    expanded: false,
  }))
}

export function flattenFolderTreeRows(nodes: FolderTreeNode[], depth = 0): FolderTreeRow[] {
  const rows: FolderTreeRow[] = []
  for (const node of nodes) {
    rows.push({ depth, node })
    if (node.isDir && node.expanded && node.children && node.children.length > 0) {
      rows.push(...flattenFolderTreeRows(node.children, depth + 1))
    }
  }
  return rows
}

function treeNodeMatchesQuickFilter(
  node: FolderTreeNode,
  quickFilter: FolderQuickFilter,
): boolean {
  if (quickFilter === 'all') {
    return true
  }
  return node.status === quickFilter
}

export function filterFolderTreeNodesByQuickFilter(
  nodes: FolderTreeNode[],
  quickFilter: FolderQuickFilter,
): FolderTreeNode[] {
  if (quickFilter === 'all') {
    return nodes
  }

  return nodes.flatMap((node) => {
    const filteredChildren = filterFolderTreeNodesByQuickFilter(node.children ?? [], quickFilter)
    const keepNode =
      treeNodeMatchesQuickFilter(node, quickFilter) || filteredChildren.length > 0

    if (!keepNode) {
      return []
    }

    return [
      {
        ...node,
        children: filteredChildren,
      },
    ]
  })
}

export function buildFolderBreadcrumbs(currentPath: string): FolderTreeBreadcrumb[] {
  const crumbs: FolderTreeBreadcrumb[] = [{ label: 'Root', path: '' }]
  if (!currentPath) {
    return crumbs
  }

  const parts = currentPath.split('/').filter((part) => part.length > 0)
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part
    crumbs.push({ label: part, path: acc })
  }
  return crumbs
}
