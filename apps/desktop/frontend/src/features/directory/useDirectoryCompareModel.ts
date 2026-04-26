import type { Dispatch, SetStateAction } from 'react'
import { useDirectoryCompareState } from '../../useDirectoryCompareState'
import { useDirectoryCompareViewState } from './useDirectoryCompareViewState'
import { useDirectoryCompareWorkflow } from './useDirectoryCompareWorkflow'
import { useDirectoryCompareChildDiffActions } from './useDirectoryCompareChildDiffActions'
import { useDirectoryChildDiffOpeners } from './useDirectoryChildDiffOpeners'
import { useDirectoryCompareInteractions } from './useDirectoryCompareInteractions'
import { formatUnknownError } from '../../utils/appHelpers'
import { showErrorNotification } from '../../utils/notifications'
import type { DesktopRecentDirectoryPair, Mode } from '../../types'

export type DirectoryCompareModelDeps = {
  mode: Mode
  setMode: (mode: Mode) => void
  loadTextFile: Parameters<typeof useDirectoryChildDiffOpeners>[0]['loadTextFile']
  compareDirectories: Parameters<typeof useDirectoryCompareViewState>[0]['compareDirectories']
  pickDirectoryRoot: Parameters<typeof useDirectoryCompareWorkflow>[0]['pickDirectoryRoot']
  runJSONCompareFromPaths: Parameters<typeof useDirectoryChildDiffOpeners>[0]['runJSONCompareFromPaths']
  runTextCompareWithValues: Parameters<typeof useDirectoryChildDiffOpeners>[0]['runTextCompareWithValues']
  resetJSONSearch: () => void
  setJSONResultView: Parameters<typeof useDirectoryChildDiffOpeners>[0]['setJSONResultView']
  clearTextExpandedSections: () => void
  resetTextSearch: () => void
  setDirectoryRecentPairs: Dispatch<SetStateAction<DesktopRecentDirectoryPair[]>>
}

export function useDirectoryCompareModel(deps: DirectoryCompareModelDeps) {
  const state = useDirectoryCompareState()
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

  const viewState = useDirectoryCompareViewState({
    directoryResult,
    directoryLeftRoot,
    directoryRightRoot,
    directoryNameFilter,
    directoryCurrentPath,
    compareDirectories: deps.compareDirectories,
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
    sortedDirectoryItems,
    selectedDirectoryItem,
    toggleDirectoryTreeNode,
    resetDirectoryNavigationState,
  } = viewState

  const workflow = useDirectoryCompareWorkflow({
    isDirectoryMode: deps.mode === 'directory',
    directoryLeftRoot,
    directoryRightRoot,
    directoryNameFilter,
    directoryCurrentPath,
    directoryResult,
    directoryViewMode,
    pickDirectoryRoot: deps.pickDirectoryRoot,
    compareDirectories: deps.compareDirectories,
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
    runJSONCompareFromPaths: deps.runJSONCompareFromPaths,
    runTextCompareWithValues: deps.runTextCompareWithValues,
    resetJSONSearch: deps.resetJSONSearch,
    setJSONResultView: deps.setJSONResultView,
    clearTextExpandedSections: deps.clearTextExpandedSections,
    resetTextSearch: deps.resetTextSearch,
    setMode: deps.setMode,
  })

  const childDiffActions = useDirectoryCompareChildDiffActions({
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

  const interactions = useDirectoryCompareInteractions({
    compareDirectories: deps.compareDirectories,
    directoryNameFilter,
    directoryResult,
    sortedDirectoryItems,
    selectedDirectoryItem,
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

  const compareDisabled = !directoryLeftRoot || !directoryRightRoot

  return {
    state,
    viewState,
    workflow,
    childDiffOpeners,
    childDiffActions,
    interactions,
    compareDisabled,
  }
}

export type DirectoryCompareModel = ReturnType<typeof useDirectoryCompareModel>
