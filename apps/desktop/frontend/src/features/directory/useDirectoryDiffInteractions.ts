import { useCallback, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type SetStateAction } from 'react'
import type {
  DiffDirectoriesRequest,
  DiffDirectoriesResponse,
  DesktopRecentDirectoryPair,
  DirectoryDiffItem,
  Mode,
} from '../../types'
import { upsertRecentDirectoryPair } from '../../persistence'
import { canOpenDirectoryItem, type DirectoryTreeNode, type DirectoryViewMode } from './directoryTree'

type UseDirectoryDiffInteractionsOptions = {
  diffDirectories?: (req: DiffDirectoriesRequest) => Promise<DiffDirectoriesResponse>
  directoryNameFilter: string
  directoryResult: DiffDirectoriesResponse | null
  sortedDirectoryItems: DirectoryDiffItem[]
  selectedDirectoryItem: DirectoryDiffItem | null
  resetDirectoryNavigationState: () => void
  openDirectoryEntryDiff: (item: DirectoryDiffItem) => Promise<void>
  toggleDirectoryTreeNode: (node: DirectoryTreeNode) => Promise<void>
  setDirectoryLeftRoot: (value: string) => void
  setDirectoryRightRoot: (value: string) => void
  setDirectoryCurrentPath: (value: string) => void
  setDirectoryViewMode: (value: DirectoryViewMode) => void
  setSelectedDirectoryItemPath: (value: string) => void
  setDirectoryResult: (value: DiffDirectoriesResponse | null) => void
  setDirectoryStatus: (value: string) => void
  setDirectoryRecentPairs: Dispatch<SetStateAction<DesktopRecentDirectoryPair[]>>
  setMode: (value: Mode) => void
}

export function useDirectoryDiffInteractions({
  diffDirectories,
  directoryNameFilter,
  directoryResult,
  sortedDirectoryItems,
  selectedDirectoryItem,
  resetDirectoryNavigationState,
  openDirectoryEntryDiff,
  toggleDirectoryTreeNode,
  setDirectoryLeftRoot,
  setDirectoryRightRoot,
  setDirectoryCurrentPath,
  setDirectoryViewMode,
  setSelectedDirectoryItemPath,
  setDirectoryResult,
  setDirectoryStatus,
  setDirectoryRecentPairs,
  setMode,
}: UseDirectoryDiffInteractionsOptions) {
  const nowISO = () => new Date().toISOString()

  const navigateDirectoryPath = useCallback(
    (nextPath: string) => {
      resetDirectoryNavigationState()
      setDirectoryCurrentPath(nextPath)
    },
    [resetDirectoryNavigationState, setDirectoryCurrentPath],
  )

  const handleDirectoryRowDoubleClick = useCallback(
    async (item: DirectoryDiffItem) => {
      const enterable = item.isDir && item.status !== 'type-mismatch'
      if (enterable) {
        navigateDirectoryPath(item.relativePath)
        return
      }

      if (canOpenDirectoryItem(item)) {
        await openDirectoryEntryDiff(item)
      }
    },
    [navigateDirectoryPath, openDirectoryEntryDiff],
  )

  const handleDirectoryTreeRowDoubleClick = useCallback(
    async (node: DirectoryTreeNode) => {
      if (node.isDir && node.item.status !== 'type-mismatch') {
        await toggleDirectoryTreeNode(node)
        return
      }
      if (canOpenDirectoryItem(node.item)) {
        await openDirectoryEntryDiff(node.item)
      }
    },
    [openDirectoryEntryDiff, toggleDirectoryTreeNode],
  )

  const handleDirectoryTableKeyDown = useCallback(
    async (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }
      const tagName = target.tagName.toLowerCase()
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable
      ) {
        return
      }

      if (sortedDirectoryItems.length === 0) {
        return
      }

      const currentIndex = selectedDirectoryItem
        ? sortedDirectoryItems.findIndex((item) => item.relativePath === selectedDirectoryItem.relativePath)
        : -1

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, sortedDirectoryItems.length - 1)
        setSelectedDirectoryItemPath(sortedDirectoryItems[nextIndex].relativePath)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1
        setSelectedDirectoryItemPath(sortedDirectoryItems[nextIndex].relativePath)
        return
      }

      if (event.key === 'Enter' && selectedDirectoryItem) {
        event.preventDefault()
        await handleDirectoryRowDoubleClick(selectedDirectoryItem)
        return
      }

      if (event.key === 'Backspace' && directoryResult?.currentPath) {
        event.preventDefault()
        navigateDirectoryPath(directoryResult.parentPath || '')
      }
    },
    [
      directoryResult,
      handleDirectoryRowDoubleClick,
      navigateDirectoryPath,
      selectedDirectoryItem,
      setSelectedDirectoryItemPath,
      sortedDirectoryItems,
    ],
  )

  const runDirectoryFromRecent = useCallback(
    async (entry: DesktopRecentDirectoryPair) => {
      if (!diffDirectories) {
        throw new Error('Wails bridge not available (DiffDirectories)')
      }

      const leftRoot = entry.leftRoot
      const rightRoot = entry.rightRoot
      const currentPath = entry.currentPath
      const viewMode = entry.viewMode

      const res: DiffDirectoriesResponse = await diffDirectories({
        leftRoot,
        rightRoot,
        currentPath,
        recursive: true,
        showSame: true,
        nameFilter: directoryNameFilter,
      } satisfies DiffDirectoriesRequest)

      setMode('directory')
      setDirectoryLeftRoot(leftRoot)
      setDirectoryRightRoot(rightRoot)
      setDirectoryCurrentPath(res.currentPath ?? currentPath)
      setDirectoryViewMode(viewMode === 'tree' ? 'tree' : 'list')
      setDirectoryResult(res)
      setDirectoryStatus(res.error ?? '')

      if (!res.error) {
        setDirectoryRecentPairs((prev) =>
          upsertRecentDirectoryPair(prev, {
            leftRoot,
            rightRoot,
            currentPath: res.currentPath ?? currentPath,
            viewMode: viewMode === 'tree' ? 'tree' : 'list',
            usedAt: nowISO(),
          }),
        )
      }
    },
    [
      diffDirectories,
      directoryNameFilter,
      setDirectoryCurrentPath,
      setDirectoryLeftRoot,
      setDirectoryRecentPairs,
      setDirectoryResult,
      setDirectoryRightRoot,
      setDirectoryStatus,
      setDirectoryViewMode,
      setMode,
    ],
  )

  return {
    navigateDirectoryPath,
    handleDirectoryRowDoubleClick,
    handleDirectoryTreeRowDoubleClick,
    handleDirectoryTableKeyDown,
    runDirectoryFromRecent,
  }
}
