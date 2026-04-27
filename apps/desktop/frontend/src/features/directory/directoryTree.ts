import type { DirectoryDiffItem } from '../../types'

export type DirectoryQuickFilter =
  | 'all'
  | 'changed'
  | 'left-only'
  | 'right-only'
  | 'type-mismatch'
  | 'error'
  | 'same'

export type DirectorySortKey = 'name' | 'status' | 'left' | 'right'

export type DirectorySortDirection = 'asc' | 'desc'

export type DirectoryViewMode = 'list' | 'tree'

export type DirectoryTreeNode = {
  path: string
  name: string
  isDir: boolean
  status: DirectoryDiffItem['status']
  item: DirectoryDiffItem
  children?: DirectoryTreeNode[]
  loaded?: boolean
  expanded?: boolean
}

export type DirectoryTreeRow = {
  depth: number
  node: DirectoryTreeNode
}

export type DirectoryTreeBreadcrumb = {
  label: string
  path: string
}

export function toneForDirectoryStatus(
  status: DirectoryDiffItem['status'],
): 'default' | 'success' | 'warning' | 'danger' | 'accent' {
  if (status === 'same') return 'success'
  if (status === 'changed') return 'warning'
  if (status === 'left-only' || status === 'right-only') return 'accent'
  if (status === 'error' || status === 'type-mismatch') return 'danger'
  return 'default'
}

export function formatDirectoryStatusLabel(status: DirectoryDiffItem['status']): string {
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

export function canOpenDirectoryItem(entry: DirectoryDiffItem): boolean {
  return (
    entry.diffModeHint !== 'none' &&
    entry.leftExists &&
    entry.rightExists &&
    entry.leftKind === 'file' &&
    entry.rightKind === 'file'
  )
}

export function getDirectoryItemActionReason(entry: DirectoryDiffItem): string | null {
  if (canOpenDirectoryItem(entry)) {
    return null
  }

  if (!entry.leftExists) return 'Only on right'
  if (!entry.rightExists) return 'Only on left'
  if (entry.leftKind !== entry.rightKind) return 'Type mismatch'
  if (entry.isDir) return 'Directory item'
  if (entry.leftKind === 'dir' || entry.rightKind === 'dir') return 'Directory item'
  if (entry.diffModeHint === 'none') return 'No diff mode'
  return 'Not comparable'
}

export function directoryQuickFilterLabel(filter: DirectoryQuickFilter): string {
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

export function filterDirectoryItemsByQuickFilter(
  items: DirectoryDiffItem[],
  quickFilter: DirectoryQuickFilter,
): DirectoryDiffItem[] {
  if (quickFilter === 'all') {
    return items
  }
  return items.filter((item) => item.status === quickFilter)
}

export function toggleDirectorySort(
  key: DirectorySortKey,
  currentKey: DirectorySortKey,
  currentDir: DirectorySortDirection,
): { key: DirectorySortKey; dir: DirectorySortDirection } {
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

export function formatDirectorySide(exists: boolean, kind: string, size: number): string {
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

export function formatDirectoryKindLabel(kind: DirectoryDiffItem['leftKind']): string {
  if (kind === 'dir') {
    return 'directory'
  }
  return kind
}

export function directoryStatusSortRank(status: DirectoryDiffItem['status']): number {
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

function sortDirectoryItemsForTree(items: DirectoryDiffItem[]): DirectoryDiffItem[] {
  return [...items].sort((left, right) => {
    if (left.isDir !== right.isDir) {
      return left.isDir ? -1 : 1
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

export function directoryItemsToTreeNodes(items: DirectoryDiffItem[]): DirectoryTreeNode[] {
  return sortDirectoryItemsForTree(items).map((item) => ({
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

export function flattenDirectoryTreeRows(nodes: DirectoryTreeNode[], depth = 0): DirectoryTreeRow[] {
  const rows: DirectoryTreeRow[] = []
  for (const node of nodes) {
    rows.push({ depth, node })
    if (node.isDir && node.expanded && node.children && node.children.length > 0) {
      rows.push(...flattenDirectoryTreeRows(node.children, depth + 1))
    }
  }
  return rows
}

function treeNodeMatchesQuickFilter(
  node: DirectoryTreeNode,
  quickFilter: DirectoryQuickFilter,
): boolean {
  if (quickFilter === 'all') {
    return true
  }
  return node.status === quickFilter
}

export function filterDirectoryTreeNodesByQuickFilter(
  nodes: DirectoryTreeNode[],
  quickFilter: DirectoryQuickFilter,
): DirectoryTreeNode[] {
  if (quickFilter === 'all') {
    return nodes
  }

  return nodes.flatMap((node) => {
    const filteredChildren = filterDirectoryTreeNodesByQuickFilter(node.children ?? [], quickFilter)
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

export function buildDirectoryBreadcrumbs(currentPath: string): DirectoryTreeBreadcrumb[] {
  const crumbs: DirectoryTreeBreadcrumb[] = [{ label: 'Root', path: '' }]
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
