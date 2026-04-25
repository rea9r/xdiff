import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FolderCompareItem } from '../../../types'
import { useDirectoryCompareChildDiffActions } from '../useDirectoryCompareChildDiffActions'

function buildEntry(compareModeHint: FolderCompareItem['compareModeHint']): FolderCompareItem {
  return {
    name: 'file.json',
    relativePath: 'dir/file.json',
    isDir: false,
    status: 'changed',
    leftPath: '/left/dir/file.json',
    rightPath: '/right/dir/file.json',
    leftExists: true,
    rightExists: true,
    leftKind: 'file',
    rightKind: 'file',
    leftSize: 10,
    rightSize: 11,
    compareModeHint,
  }
}

describe('useDirectoryCompareChildDiffActions', () => {
  it('opens JSON diff and stores folder return context', async () => {
    const onOpenJSONDiff = vi.fn(async () => undefined)

    const { result } = renderHook(() =>
      useDirectoryCompareChildDiffActions({
        folderLeftRoot: '/left',
        folderRightRoot: '/right',
        folderCurrentPath: 'dir',
        folderViewMode: 'tree',
        setFolderLeftRoot: vi.fn(),
        setFolderRightRoot: vi.fn(),
        setFolderCurrentPath: vi.fn(),
        setSelectedFolderItemPath: vi.fn(),
        setFolderViewMode: vi.fn(),
        setFolderStatus: vi.fn(),
        setMode: vi.fn(),
        onOpenJSONDiff,
        onOpenTextDiff: vi.fn(async () => undefined),
      }),
    )

    const entry = buildEntry('json')

    await act(async () => {
      await result.current.openFolderEntryDiff(entry)
    })

    expect(onOpenJSONDiff).toHaveBeenCalledWith(entry)
    expect(result.current.folderOpenBusyPath).toBe('')
    expect(result.current.folderReturnContext).toMatchObject({
      leftRoot: '/left',
      rightRoot: '/right',
      currentPath: 'dir',
      selectedPath: 'dir/file.json',
      viewMode: 'tree',
    })
  })

  it('returnToFolderCompare restores context and switches mode', async () => {
    const setFolderLeftRoot = vi.fn()
    const setFolderRightRoot = vi.fn()
    const setFolderCurrentPath = vi.fn()
    const setSelectedFolderItemPath = vi.fn()
    const setFolderViewMode = vi.fn()
    const setMode = vi.fn()

    const { result } = renderHook(() =>
      useDirectoryCompareChildDiffActions({
        folderLeftRoot: '/left',
        folderRightRoot: '/right',
        folderCurrentPath: 'dir',
        folderViewMode: 'list',
        setFolderLeftRoot,
        setFolderRightRoot,
        setFolderCurrentPath,
        setSelectedFolderItemPath,
        setFolderViewMode,
        setFolderStatus: vi.fn(),
        setMode,
        onOpenJSONDiff: vi.fn(async () => undefined),
        onOpenTextDiff: vi.fn(async () => undefined),
      }),
    )

    await act(async () => {
      await result.current.openFolderEntryDiff(buildEntry('text'))
    })

    act(() => {
      result.current.returnToFolderCompare()
    })

    expect(setFolderLeftRoot).toHaveBeenCalledWith('/left')
    expect(setFolderRightRoot).toHaveBeenCalledWith('/right')
    expect(setFolderCurrentPath).toHaveBeenCalledWith('dir')
    expect(setSelectedFolderItemPath).toHaveBeenCalledWith('dir/file.json')
    expect(setFolderViewMode).toHaveBeenCalledWith('list')
    expect(setMode).toHaveBeenCalledWith('folder')
  })

  it('reports open diff error via status and callback', async () => {
    const setFolderStatus = vi.fn()
    const onOpenChildDiffError = vi.fn()

    const { result } = renderHook(() =>
      useDirectoryCompareChildDiffActions({
        folderLeftRoot: '/left',
        folderRightRoot: '/right',
        folderCurrentPath: '',
        folderViewMode: 'list',
        setFolderLeftRoot: vi.fn(),
        setFolderRightRoot: vi.fn(),
        setFolderCurrentPath: vi.fn(),
        setSelectedFolderItemPath: vi.fn(),
        setFolderViewMode: vi.fn(),
        setFolderStatus,
        setMode: vi.fn(),
        onOpenJSONDiff: vi.fn(async () => {
          throw new Error('boom')
        }),
        onOpenTextDiff: vi.fn(async () => undefined),
        onOpenChildDiffError,
      }),
    )

    await act(async () => {
      await result.current.openFolderEntryDiff(buildEntry('json'))
    })

    expect(setFolderStatus).toHaveBeenCalledWith('Failed to open diff: boom')
    expect(onOpenChildDiffError).toHaveBeenCalledWith('Failed to open diff: boom')
    expect(result.current.folderOpenBusyPath).toBe('')
  })
})
