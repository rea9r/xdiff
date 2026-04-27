import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DiffDirectoriesRequest, DiffDirectoriesResponse, DesktopRecentDirectoryPair } from '../../../types'
import { useDirectoryDiffWorkflow } from '../useDirectoryDiffWorkflow'

function createResponse(currentPath: string): DiffDirectoriesResponse {
  return {
    currentPath,
    scannedSummary: {
      total: 1,
      same: 0,
      changed: 1,
      leftOnly: 0,
      rightOnly: 0,
      typeMismatch: 0,
      error: 0,
    },
    currentSummary: {
      total: 1,
      same: 0,
      changed: 1,
      leftOnly: 0,
      rightOnly: 0,
      typeMismatch: 0,
      error: 0,
    },
    items: [],
  }
}

describe('useDirectoryDiffWorkflow', () => {
  it('runDirectoryDiff updates result/currentPath and recent pair', async () => {
    const diffDirectories = vi.fn(async (req: DiffDirectoriesRequest) => createResponse(req.currentPath))
    const setDirectoryRecentPairs = vi.fn()
    const setDirectoryResult = vi.fn()
    const setDirectoryCurrentPath = vi.fn()
    const setDirectoryStatus = vi.fn()

    const { result } = renderHook(() =>
      useDirectoryDiffWorkflow({
        isDirectoryMode: true,
        directoryLeftRoot: '/left',
        directoryRightRoot: '/right',
        directoryNameFilter: '',
        directoryCurrentPath: 'a/b',
        directoryResult: null,
        directoryViewMode: 'tree',
        diffDirectories,
        setDirectoryLeftRoot: vi.fn(),
        setDirectoryRightRoot: vi.fn(),
        setDirectoryCurrentPath,
        setDirectoryResult,
        setDirectoryStatus,
        setDirectoryRecentPairs,
        setSelectedDirectoryItemPath: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.runDirectoryDiff('a/b')
    })

    expect(diffDirectories).toHaveBeenCalledWith({
      leftRoot: '/left',
      rightRoot: '/right',
      currentPath: 'a/b',
      recursive: true,
      showSame: true,
      nameFilter: '',
    })
    expect(setDirectoryResult).toHaveBeenCalled()
    expect(setDirectoryCurrentPath).toHaveBeenCalledWith('a/b')
    expect(setDirectoryStatus).toHaveBeenCalledWith('')

    const updater = setDirectoryRecentPairs.mock.calls[0][0] as (prev: DesktopRecentDirectoryPair[]) => DesktopRecentDirectoryPair[]
    const updated = updater([])
    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({
      leftRoot: '/left',
      rightRoot: '/right',
      currentPath: 'a/b',
      viewMode: 'tree',
    })
  })

  it('browseDirectoryRoot resets state when directory selected', async () => {
    const setDirectoryLeftRoot = vi.fn()
    const setDirectoryCurrentPath = vi.fn()
    const setSelectedDirectoryItemPath = vi.fn()
    const setDirectoryResult = vi.fn()
    const setDirectoryStatus = vi.fn()

    const { result } = renderHook(() =>
      useDirectoryDiffWorkflow({
        isDirectoryMode: true,
        directoryLeftRoot: '',
        directoryRightRoot: '',
        directoryNameFilter: '',
        directoryCurrentPath: '',
        directoryResult: null,
        directoryViewMode: 'list',
        pickDirectoryRoot: async () => '/picked',
        setDirectoryLeftRoot,
        setDirectoryRightRoot: vi.fn(),
        setDirectoryCurrentPath,
        setDirectoryResult,
        setDirectoryStatus,
        setDirectoryRecentPairs: vi.fn(),
        setSelectedDirectoryItemPath,
      }),
    )

    await act(async () => {
      await result.current.browseDirectoryRoot('left')
    })

    expect(setDirectoryLeftRoot).toHaveBeenCalledWith('/picked')
    expect(setDirectoryCurrentPath).toHaveBeenCalledWith('')
    expect(setSelectedDirectoryItemPath).toHaveBeenCalledWith('')
    expect(setDirectoryResult).toHaveBeenCalledWith(null)
    expect(setDirectoryStatus).toHaveBeenCalledWith('')
  })

  it('effect reruns diff when currentPath diverges from result path', async () => {
    const diffDirectories = vi.fn(async () => createResponse('new/path'))

    renderHook(() =>
      useDirectoryDiffWorkflow({
        isDirectoryMode: true,
        directoryLeftRoot: '/left',
        directoryRightRoot: '/right',
        directoryNameFilter: '',
        directoryCurrentPath: 'old/path',
        directoryResult: createResponse('new/path'),
        directoryViewMode: 'list',
        diffDirectories,
        setDirectoryLeftRoot: vi.fn(),
        setDirectoryRightRoot: vi.fn(),
        setDirectoryCurrentPath: vi.fn(),
        setDirectoryResult: vi.fn(),
        setDirectoryStatus: vi.fn(),
        setDirectoryRecentPairs: vi.fn(),
        setSelectedDirectoryItemPath: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(diffDirectories).toHaveBeenCalled()
    })
  })
})
