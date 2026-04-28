import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import type {
  DiffDirectoriesRequest,
  DiffDirectoriesResponse,
  DesktopRecentDirectoryPair,
} from '../../types'
import { upsertRecentDirectoryPair } from '../../persistence'
import { formatUnknownError } from '../../utils/appHelpers'
import type { DirectoryViewMode } from './directoryTree'

type UseDirectoryDiffWorkflowOptions = {
  isDirectoryMode: boolean
  directoryLeftRoot: string
  directoryRightRoot: string
  directoryCurrentPath: string
  directoryResult: DiffDirectoriesResponse | null
  directoryViewMode: DirectoryViewMode
  pickDirectoryRoot?: () => Promise<string>
  diffDirectories?: (req: DiffDirectoriesRequest) => Promise<DiffDirectoriesResponse>
  setDirectoryLeftRoot: (value: string) => void
  setDirectoryRightRoot: (value: string) => void
  setDirectoryCurrentPath: (value: string) => void
  setDirectoryResult: (value: DiffDirectoriesResponse | null) => void
  setDirectoryStatus: (value: string) => void
  setDirectoryRecentPairs: Dispatch<SetStateAction<DesktopRecentDirectoryPair[]>>
  setSelectedDirectoryItemPath: (value: string) => void
  onDirectoryPickerUnavailable?: () => void
  onDirectoryPickerError?: (message: string) => void
}

export function useDirectoryDiffWorkflow({
  isDirectoryMode,
  directoryLeftRoot,
  directoryRightRoot,
  directoryCurrentPath,
  directoryResult,
  directoryViewMode,
  pickDirectoryRoot,
  diffDirectories,
  setDirectoryLeftRoot,
  setDirectoryRightRoot,
  setDirectoryCurrentPath,
  setDirectoryResult,
  setDirectoryStatus,
  setDirectoryRecentPairs,
  setSelectedDirectoryItemPath,
  onDirectoryPickerUnavailable,
  onDirectoryPickerError,
}: UseDirectoryDiffWorkflowOptions) {
  const nowISO = () => new Date().toISOString()

  const runDirectoryDiff = useCallback(
    async (nextCurrentPath = directoryCurrentPath) => {
      if (!diffDirectories) {
        throw new Error('Wails bridge not available (DiffDirectories)')
      }

      setDirectoryStatus('')

      const res: DiffDirectoriesResponse = await diffDirectories({
        leftRoot: directoryLeftRoot,
        rightRoot: directoryRightRoot,
        currentPath: nextCurrentPath,
        recursive: true,
        showSame: true,
      } satisfies DiffDirectoriesRequest)

      setDirectoryResult(res)
      setDirectoryCurrentPath(res.currentPath ?? nextCurrentPath)

      if (res.error) {
        setDirectoryStatus(res.error)
        return
      }

      setDirectoryStatus('')
      setDirectoryRecentPairs((prev) =>
        upsertRecentDirectoryPair(prev, {
          leftRoot: directoryLeftRoot,
          rightRoot: directoryRightRoot,
          currentPath: res.currentPath ?? nextCurrentPath,
          viewMode: directoryViewMode,
          usedAt: nowISO(),
        }),
      )
    },
    [
      diffDirectories,
      directoryCurrentPath,
      directoryLeftRoot,
      directoryRightRoot,
      directoryViewMode,
      setDirectoryCurrentPath,
      setDirectoryRecentPairs,
      setDirectoryResult,
      setDirectoryStatus,
    ],
  )

  useEffect(() => {
    if (!isDirectoryMode) {
      return
    }
    if (!directoryResult) {
      return
    }
    if (!directoryLeftRoot || !directoryRightRoot) {
      return
    }

    const resultPath = directoryResult.currentPath ?? ''
    if (resultPath === directoryCurrentPath) {
      return
    }

    void runDirectoryDiff(directoryCurrentPath)
  }, [
    directoryCurrentPath,
    directoryLeftRoot,
    directoryResult,
    directoryRightRoot,
    isDirectoryMode,
    runDirectoryDiff,
  ])

  const setDirectoryRootPath = useCallback(
    (target: 'left' | 'right', path: string) => {
      if (target === 'left') {
        setDirectoryLeftRoot(path)
      } else {
        setDirectoryRightRoot(path)
      }

      setDirectoryCurrentPath('')
      setSelectedDirectoryItemPath('')
      setDirectoryResult(null)
      setDirectoryStatus('')
    },
    [
      setDirectoryCurrentPath,
      setDirectoryLeftRoot,
      setDirectoryResult,
      setDirectoryRightRoot,
      setDirectoryStatus,
      setSelectedDirectoryItemPath,
    ],
  )

  const browseDirectoryRoot = useCallback(
    async (target: 'left' | 'right') => {
      if (!pickDirectoryRoot) {
        setDirectoryStatus('Directory picker is not available.')
        onDirectoryPickerUnavailable?.()
        return
      }

      try {
        const selected = await pickDirectoryRoot()
        if (!selected) {
          return
        }

        setDirectoryRootPath(target, selected)
      } catch (error) {
        const message = `Failed to pick directory: ${formatUnknownError(error)}`
        setDirectoryStatus(message)
        onDirectoryPickerError?.(message)
      }
    },
    [
      onDirectoryPickerError,
      onDirectoryPickerUnavailable,
      pickDirectoryRoot,
      setDirectoryRootPath,
      setDirectoryStatus,
    ],
  )

  return {
    browseDirectoryRoot,
    setDirectoryRootPath,
    runDirectoryDiff,
  }
}
