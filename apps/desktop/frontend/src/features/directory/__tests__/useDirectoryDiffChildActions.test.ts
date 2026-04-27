import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DirectoryDiffItem } from '../../../types'
import { useDirectoryDiffChildActions } from '../useDirectoryDiffChildActions'

function buildEntry(diffModeHint: DirectoryDiffItem['diffModeHint']): DirectoryDiffItem {
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
    diffModeHint,
  }
}

describe('useDirectoryDiffChildActions', () => {
  it('opens JSON diff and stores directory return context', async () => {
    const onOpenJSONDiff = vi.fn(async () => undefined)

    const { result } = renderHook(() =>
      useDirectoryDiffChildActions({
        directoryLeftRoot: '/left',
        directoryRightRoot: '/right',
        directoryCurrentPath: 'dir',
        directoryViewMode: 'tree',
        setDirectoryLeftRoot: vi.fn(),
        setDirectoryRightRoot: vi.fn(),
        setDirectoryCurrentPath: vi.fn(),
        setSelectedDirectoryItemPath: vi.fn(),
        setDirectoryViewMode: vi.fn(),
        setDirectoryStatus: vi.fn(),
        setMode: vi.fn(),
        onOpenJSONDiff,
        onOpenTextDiff: vi.fn(async () => undefined),
      }),
    )

    const entry = buildEntry('json')

    await act(async () => {
      await result.current.openDirectoryEntryDiff(entry)
    })

    expect(onOpenJSONDiff).toHaveBeenCalledWith(entry)
    expect(result.current.directoryOpenBusyPath).toBe('')
    expect(result.current.directoryReturnContext).toMatchObject({
      leftRoot: '/left',
      rightRoot: '/right',
      currentPath: 'dir',
      selectedPath: 'dir/file.json',
      viewMode: 'tree',
    })
  })

  it('returnToDirectoryDiff restores context and switches mode', async () => {
    const setDirectoryLeftRoot = vi.fn()
    const setDirectoryRightRoot = vi.fn()
    const setDirectoryCurrentPath = vi.fn()
    const setSelectedDirectoryItemPath = vi.fn()
    const setDirectoryViewMode = vi.fn()
    const setMode = vi.fn()

    const { result } = renderHook(() =>
      useDirectoryDiffChildActions({
        directoryLeftRoot: '/left',
        directoryRightRoot: '/right',
        directoryCurrentPath: 'dir',
        directoryViewMode: 'list',
        setDirectoryLeftRoot,
        setDirectoryRightRoot,
        setDirectoryCurrentPath,
        setSelectedDirectoryItemPath,
        setDirectoryViewMode,
        setDirectoryStatus: vi.fn(),
        setMode,
        onOpenJSONDiff: vi.fn(async () => undefined),
        onOpenTextDiff: vi.fn(async () => undefined),
      }),
    )

    await act(async () => {
      await result.current.openDirectoryEntryDiff(buildEntry('text'))
    })

    act(() => {
      result.current.returnToDirectoryDiff()
    })

    expect(setDirectoryLeftRoot).toHaveBeenCalledWith('/left')
    expect(setDirectoryRightRoot).toHaveBeenCalledWith('/right')
    expect(setDirectoryCurrentPath).toHaveBeenCalledWith('dir')
    expect(setSelectedDirectoryItemPath).toHaveBeenCalledWith('dir/file.json')
    expect(setDirectoryViewMode).toHaveBeenCalledWith('list')
    expect(setMode).toHaveBeenCalledWith('directory')
  })

  it('reports open diff error via status and callback', async () => {
    const setDirectoryStatus = vi.fn()
    const onOpenChildDiffError = vi.fn()

    const { result } = renderHook(() =>
      useDirectoryDiffChildActions({
        directoryLeftRoot: '/left',
        directoryRightRoot: '/right',
        directoryCurrentPath: '',
        directoryViewMode: 'list',
        setDirectoryLeftRoot: vi.fn(),
        setDirectoryRightRoot: vi.fn(),
        setDirectoryCurrentPath: vi.fn(),
        setSelectedDirectoryItemPath: vi.fn(),
        setDirectoryViewMode: vi.fn(),
        setDirectoryStatus,
        setMode: vi.fn(),
        onOpenJSONDiff: vi.fn(async () => {
          throw new Error('boom')
        }),
        onOpenTextDiff: vi.fn(async () => undefined),
        onOpenChildDiffError,
      }),
    )

    await act(async () => {
      await result.current.openDirectoryEntryDiff(buildEntry('json'))
    })

    expect(setDirectoryStatus).toHaveBeenCalledWith('Failed to open diff: boom')
    expect(onOpenChildDiffError).toHaveBeenCalledWith('Failed to open diff: boom')
    expect(result.current.directoryOpenBusyPath).toBe('')
  })
})
