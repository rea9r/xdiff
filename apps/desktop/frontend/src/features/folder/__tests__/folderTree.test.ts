import { describe, expect, it } from 'vitest'
import {
  buildFolderBreadcrumbs,
  filterFolderTreeNodesByQuickFilter,
  toggleFolderSort,
  type FolderTreeNode,
} from '../folderTree'
import type { FolderCompareItem } from '../../../types'

function makeItem(
  relativePath: string,
  status: FolderCompareItem['status'],
  isDir: boolean,
): FolderCompareItem {
  return {
    name: relativePath.split('/').pop() ?? relativePath,
    relativePath,
    isDir,
    status,
    leftPath: `/left/${relativePath}`,
    rightPath: `/right/${relativePath}`,
    leftExists: true,
    rightExists: true,
    leftKind: isDir ? 'dir' : 'file',
    rightKind: isDir ? 'dir' : 'file',
    leftSize: isDir ? 0 : 10,
    rightSize: isDir ? 0 : 20,
    compareModeHint: isDir ? 'none' : 'text',
  }
}

function makeNode(path: string, status: FolderCompareItem['status'], children: FolderTreeNode[] = []): FolderTreeNode {
  const isDir = children.length > 0
  return {
    path,
    name: path.split('/').pop() ?? path,
    isDir,
    status,
    item: makeItem(path, status, isDir),
    children,
    loaded: true,
    expanded: false,
  }
}

describe('folderTree helpers', () => {
  it('toggleFolderSort flips direction when sorting same key', () => {
    expect(toggleFolderSort('name', 'name', 'asc')).toEqual({ key: 'name', dir: 'desc' })
    expect(toggleFolderSort('name', 'name', 'desc')).toEqual({ key: 'name', dir: 'asc' })
  })

  it('toggleFolderSort resets to asc when key changes', () => {
    expect(toggleFolderSort('status', 'name', 'desc')).toEqual({ key: 'status', dir: 'asc' })
  })

  it('filterFolderTreeNodesByQuickFilter keeps parent when child matches', () => {
    const tree = [
      makeNode('root', 'same', [
        makeNode('root/file-same.txt', 'same'),
        makeNode('root/file-error.txt', 'error'),
      ]),
    ]

    const filtered = filterFolderTreeNodesByQuickFilter(tree, 'error')

    expect(filtered).toHaveLength(1)
    expect(filtered[0].path).toBe('root')
    expect(filtered[0].children).toHaveLength(1)
    expect(filtered[0].children?.[0].path).toBe('root/file-error.txt')
  })

  it('buildFolderBreadcrumbs returns root and nested crumbs', () => {
    expect(buildFolderBreadcrumbs('')).toEqual([{ label: 'Root', path: '' }])
    expect(buildFolderBreadcrumbs('a/b')).toEqual([
      { label: 'Root', path: '' },
      { label: 'a', path: 'a' },
      { label: 'b', path: 'a/b' },
    ])
  })
})
