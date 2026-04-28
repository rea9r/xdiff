import { useCallback, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type SetStateAction } from 'react'
import type {
  DiffDirectoriesRequest,
  DiffDirectoriesResponse,
  DesktopRecentDirectoryPair,
  DirectoryDiffItem,
  Mode,
} from '../../types'
import { upsertRecentDirectoryPair } from '../../persistence'
import {
  canOpenDirectoryItem,
  type DirectoryTreeNode,
  type DirectoryTreeRow,
  type DirectoryViewMode,
} from './directoryTree'

type UseDirectoryDiffInteractionsOptions = {
  diffDirectories?: (req: DiffDirectoriesRequest) => Promise<DiffDirectoriesResponse>
  directoryResult: DiffDirectoriesResponse | null
  sortedDirectoryItems: DirectoryDiffItem[]
  selectedDirectoryItem: DirectoryDiffItem | null
  selectedDirectoryItemPath: string
  flattenedDirectoryTreeRows: DirectoryTreeRow[]
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
  directoryResult,
  sortedDirectoryItems,
  selectedDirectoryItem,
  selectedDirectoryItemPath,
  flattenedDirectoryTreeRows,
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

      const isOwnedKey =
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === 'Backspace'
      if (isOwnedKey) {
        event.currentTarget.focus({ preventScroll: true })
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

  const handleDirectoryTreeKeyDown = useCallback(
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

      if (flattenedDirectoryTreeRows.length === 0) {
        return
      }

      const isOwnedKey =
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'Enter' ||
        event.key === 'Backspace'
      if (isOwnedKey) {
        event.currentTarget.focus({ preventScroll: true })
      }

      const currentIndex = selectedDirectoryItemPath
        ? flattenedDirectoryTreeRows.findIndex((row) => row.node.path === selectedDirectoryItemPath)
        : -1

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex =
          currentIndex < 0 ? 0 : Math.min(currentIndex + 1, flattenedDirectoryTreeRows.length - 1)
        setSelectedDirectoryItemPath(flattenedDirectoryTreeRows[nextIndex].node.path)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1
        setSelectedDirectoryItemPath(flattenedDirectoryTreeRows[nextIndex].node.path)
        return
      }

      if (event.key === 'ArrowRight') {
        if (currentIndex < 0) {
          return
        }
        const row = flattenedDirectoryTreeRows[currentIndex]
        if (!row.node.isDir || row.node.item.status === 'type-mismatch') {
          return
        }
        event.preventDefault()
        if (!row.node.expanded) {
          await toggleDirectoryTreeNode(row.node)
        } else if (
          currentIndex + 1 < flattenedDirectoryTreeRows.length &&
          flattenedDirectoryTreeRows[currentIndex + 1].depth > row.depth
        ) {
          setSelectedDirectoryItemPath(flattenedDirectoryTreeRows[currentIndex + 1].node.path)
        }
        return
      }

      if (event.key === 'ArrowLeft') {
        if (currentIndex < 0) {
          return
        }
        const row = flattenedDirectoryTreeRows[currentIndex]
        event.preventDefault()
        if (row.node.isDir && row.node.expanded) {
          await toggleDirectoryTreeNode(row.node)
          return
        }
        // Otherwise jump to the nearest ancestor row in the flattened view.
        for (let i = currentIndex - 1; i >= 0; i--) {
          if (flattenedDirectoryTreeRows[i].depth < row.depth) {
            setSelectedDirectoryItemPath(flattenedDirectoryTreeRows[i].node.path)
            break
          }
        }
        return
      }

      if (event.key === 'Enter' && currentIndex >= 0) {
        event.preventDefault()
        await handleDirectoryTreeRowDoubleClick(flattenedDirectoryTreeRows[currentIndex].node)
        return
      }

      if (event.key === 'Backspace' && directoryResult?.currentPath) {
        event.preventDefault()
        navigateDirectoryPath(directoryResult.parentPath || '')
      }
    },
    [
      directoryResult,
      flattenedDirectoryTreeRows,
      handleDirectoryTreeRowDoubleClick,
      navigateDirectoryPath,
      selectedDirectoryItemPath,
      setSelectedDirectoryItemPath,
      toggleDirectoryTreeNode,
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
    handleDirectoryTreeKeyDown,
    runDirectoryFromRecent,
  }
}
