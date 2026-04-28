import type { Dispatch, SetStateAction } from 'react'
import { useDirectoryDiffState } from '../../useDirectoryDiffState'
import { useDirectoryDiffViewState } from './useDirectoryDiffViewState'
import { useDirectoryDiffWorkflow } from './useDirectoryDiffWorkflow'
import { useDirectoryDiffChildActions } from './useDirectoryDiffChildActions'
import { useDirectoryChildDiffOpeners } from './useDirectoryChildDiffOpeners'
import { useDirectoryDiffInteractions } from './useDirectoryDiffInteractions'
import { formatUnknownError } from '../../utils/appHelpers'
import { showErrorNotification } from '../../utils/notifications'
import type { DesktopRecentDirectoryPair, Mode } from '../../types'

type DirectoryDiffModelDeps = {
  mode: Mode
  setMode: (mode: Mode) => void
  loadTextFile: Parameters<typeof useDirectoryChildDiffOpeners>[0]['loadTextFile']
  diffDirectories: Parameters<typeof useDirectoryDiffViewState>[0]['diffDirectories']
  pickDirectoryRoot: Parameters<typeof useDirectoryDiffWorkflow>[0]['pickDirectoryRoot']
  runJSONDiffFromPaths: Parameters<typeof useDirectoryChildDiffOpeners>[0]['runJSONDiffFromPaths']
  runTextDiffWithValues: Parameters<typeof useDirectoryChildDiffOpeners>[0]['runTextDiffWithValues']
  resetJSONSearch: () => void
  setJSONResultView: Parameters<typeof useDirectoryChildDiffOpeners>[0]['setJSONResultView']
  clearTextExpandedSections: () => void
  resetTextSearch: () => void
  setDirectoryRecentPairs: Dispatch<SetStateAction<DesktopRecentDirectoryPair[]>>
}

export function useDirectoryDiffModel(deps: DirectoryDiffModelDeps) {
  const state = useDirectoryDiffState()
  const { setDirectoryRecentPairs } = deps

  const {
    directoryLeftRoot,
    setDirectoryLeftRoot,
    directoryRightRoot,
    setDirectoryRightRoot,
    directoryNameFilter,
    setDirectoryNameFilter,
    directoryCurrentPath,
    setDirectoryCurrentPath,
    directoryResult,
    setDirectoryResult,
    directoryStatus,
    setDirectoryStatus,
  } = state

  const viewState = useDirectoryDiffViewState({
    directoryResult,
    directoryLeftRoot,
    directoryRightRoot,
    directoryNameFilter,
    directoryCurrentPath,
    diffDirectories: deps.diffDirectories,
    onDirectoryTreeLoadError: (error) => {
      const message = `Failed to load directory children: ${formatUnknownError(error)}`
      setDirectoryStatus(message)
      showErrorNotification('Failed to load directory', message)
    },
  })

  const {
    directoryViewMode,
    setDirectoryViewMode,
    setSelectedDirectoryItemPath,
    selectedDirectoryItemPath,
    sortedDirectoryItems,
    selectedDirectoryItem,
    flattenedDirectoryTreeRows,
    toggleDirectoryTreeNode,
    resetDirectoryNavigationState,
  } = viewState

  const workflow = useDirectoryDiffWorkflow({
    isDirectoryMode: deps.mode === 'directory',
    directoryLeftRoot,
    directoryRightRoot,
    directoryCurrentPath,
    directoryResult,
    directoryViewMode,
    pickDirectoryRoot: deps.pickDirectoryRoot,
    diffDirectories: deps.diffDirectories,
    setDirectoryLeftRoot,
    setDirectoryRightRoot,
    setDirectoryCurrentPath,
    setDirectoryResult,
    setDirectoryStatus,
    setDirectoryRecentPairs,
    setSelectedDirectoryItemPath,
    onDirectoryPickerUnavailable: () => {
      showErrorNotification('Directory picker unavailable', 'Directory picker is not available.')
    },
    onDirectoryPickerError: (message) => {
      showErrorNotification('Failed to pick directory', message)
    },
  })

  const childDiffOpeners = useDirectoryChildDiffOpeners({
    loadTextFile: deps.loadTextFile,
    runJSONDiffFromPaths: deps.runJSONDiffFromPaths,
    runTextDiffWithValues: deps.runTextDiffWithValues,
    resetJSONSearch: deps.resetJSONSearch,
    setJSONResultView: deps.setJSONResultView,
    clearTextExpandedSections: deps.clearTextExpandedSections,
    resetTextSearch: deps.resetTextSearch,
    setMode: deps.setMode,
  })

  const childDiffActions = useDirectoryDiffChildActions({
    directoryLeftRoot,
    directoryRightRoot,
    directoryCurrentPath,
    directoryViewMode,
    setDirectoryLeftRoot,
    setDirectoryRightRoot,
    setDirectoryCurrentPath,
    setSelectedDirectoryItemPath,
    setDirectoryViewMode,
    setDirectoryStatus,
    setMode: deps.setMode,
    onOpenJSONDiff: childDiffOpeners.openDirectoryJSONDiff,
    onOpenTextDiff: childDiffOpeners.openDirectoryTextDiff,
    onOpenChildDiffError: (message) => {
      showErrorNotification('Failed to open child diff', message)
    },
  })

  const interactions = useDirectoryDiffInteractions({
    diffDirectories: deps.diffDirectories,
    directoryResult,
    sortedDirectoryItems,
    selectedDirectoryItem,
    selectedDirectoryItemPath,
    flattenedDirectoryTreeRows,
    resetDirectoryNavigationState,
    openDirectoryEntryDiff: childDiffActions.openDirectoryEntryDiff,
    toggleDirectoryTreeNode,
    setDirectoryLeftRoot,
    setDirectoryRightRoot,
    setDirectoryCurrentPath,
    setDirectoryViewMode,
    setSelectedDirectoryItemPath,
    setDirectoryResult,
    setDirectoryStatus,
    setDirectoryRecentPairs,
    setMode: deps.setMode,
  })

  const diffDisabled = !directoryLeftRoot || !directoryRightRoot

  return {
    state,
    viewState,
    workflow,
    childDiffOpeners,
    childDiffActions,
    interactions,
    diffDisabled,
  }
}

type DirectoryDiffModel = ReturnType<typeof useDirectoryDiffModel>
