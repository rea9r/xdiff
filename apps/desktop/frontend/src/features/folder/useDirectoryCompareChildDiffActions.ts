import { useCallback, useState } from 'react'
import type { FolderCompareItem, Mode } from '../../types'
import { formatUnknownError } from '../../utils/appHelpers'
import { canOpenFolderItem, type FolderViewMode } from './folderTree'

type FolderReturnContext = {
  leftRoot: string
  rightRoot: string
  currentPath: string
  selectedPath: string
  viewMode: FolderViewMode
}

type UseDirectoryCompareChildDiffActionsOptions = {
  folderLeftRoot: string
  folderRightRoot: string
  folderCurrentPath: string
  folderViewMode: FolderViewMode
  setFolderLeftRoot: (value: string) => void
  setFolderRightRoot: (value: string) => void
  setFolderCurrentPath: (value: string) => void
  setSelectedFolderItemPath: (value: string) => void
  setFolderViewMode: (value: FolderViewMode) => void
  setFolderStatus: (value: string) => void
  setMode: (value: Mode) => void
  onOpenJSONDiff: (entry: FolderCompareItem) => Promise<void>
  onOpenTextDiff: (entry: FolderCompareItem) => Promise<void>
  onOpenChildDiffError?: (message: string) => void
}

export function useDirectoryCompareChildDiffActions({
  folderLeftRoot,
  folderRightRoot,
  folderCurrentPath,
  folderViewMode,
  setFolderLeftRoot,
  setFolderRightRoot,
  setFolderCurrentPath,
  setSelectedFolderItemPath,
  setFolderViewMode,
  setFolderStatus,
  setMode,
  onOpenJSONDiff,
  onOpenTextDiff,
  onOpenChildDiffError,
}: UseDirectoryCompareChildDiffActionsOptions) {
  const [folderOpenBusyPath, setFolderOpenBusyPath] = useState('')
  const [folderReturnContext, setFolderReturnContext] =
    useState<FolderReturnContext | null>(null)

  const openFolderEntryDiff = useCallback(
    async (entry: FolderCompareItem) => {
      if (!canOpenFolderItem(entry)) {
        return
      }

      setFolderReturnContext({
        leftRoot: folderLeftRoot,
        rightRoot: folderRightRoot,
        currentPath: folderCurrentPath,
        selectedPath: entry.relativePath,
        viewMode: folderViewMode,
      })
      setFolderOpenBusyPath(entry.relativePath)
      setFolderStatus('')

      try {
        if (entry.compareModeHint === 'json') {
          await onOpenJSONDiff(entry)
          return
        }

        await onOpenTextDiff(entry)
      } catch (error) {
        const message = `Failed to open diff: ${formatUnknownError(error)}`
        setFolderStatus(message)
        onOpenChildDiffError?.(message)
      } finally {
        setFolderOpenBusyPath('')
      }
    },
    [
      folderCurrentPath,
      folderLeftRoot,
      folderRightRoot,
      folderViewMode,
      onOpenChildDiffError,
      onOpenJSONDiff,
      onOpenTextDiff,
      setFolderStatus,
    ],
  )

  const returnToFolderCompare = useCallback(() => {
    if (folderReturnContext) {
      setFolderLeftRoot(folderReturnContext.leftRoot)
      setFolderRightRoot(folderReturnContext.rightRoot)
      setFolderCurrentPath(folderReturnContext.currentPath)
      setSelectedFolderItemPath(folderReturnContext.selectedPath)
      setFolderViewMode(folderReturnContext.viewMode)
    }
    setMode('folder')
  }, [
    folderReturnContext,
    setFolderCurrentPath,
    setFolderLeftRoot,
    setFolderRightRoot,
    setFolderViewMode,
    setMode,
    setSelectedFolderItemPath,
  ])

  return {
    folderOpenBusyPath,
    folderReturnContext,
    openFolderEntryDiff,
    returnToFolderCompare,
  }
}
