import { useFolderCompareState } from '../../useFolderCompareState'
import { useDirectoryCompareViewState } from './useDirectoryCompareViewState'
import { useDirectoryCompareWorkflow } from './useDirectoryCompareWorkflow'
import { useDirectoryCompareChildDiffActions } from './useDirectoryCompareChildDiffActions'
import { useFolderChildDiffOpeners } from './useFolderChildDiffOpeners'
import { useDirectoryCompareInteractions } from './useDirectoryCompareInteractions'
import { formatUnknownError } from '../../utils/appHelpers'
import { showErrorNotification } from '../../utils/notifications'
import type { Mode } from '../../types'

export type FolderCompareModelDeps = {
  mode: Mode
  setMode: (mode: Mode) => void
  loadTextFile: Parameters<typeof useFolderChildDiffOpeners>[0]['loadTextFile']
  compareFolders: Parameters<typeof useDirectoryCompareViewState>[0]['compareFolders']
  pickFolderRoot: Parameters<typeof useDirectoryCompareWorkflow>[0]['pickFolderRoot']
  runJSONCompareFromPaths: Parameters<typeof useFolderChildDiffOpeners>[0]['runJSONCompareFromPaths']
  runTextCompareWithValues: Parameters<typeof useFolderChildDiffOpeners>[0]['runTextCompareWithValues']
  resetJSONSearch: () => void
  setJSONResultView: Parameters<typeof useFolderChildDiffOpeners>[0]['setJSONResultView']
  clearTextExpandedSections: () => void
  resetTextSearch: () => void
}

export function useFolderCompareModel(deps: FolderCompareModelDeps) {
  const state = useFolderCompareState()

  const {
    folderLeftRoot,
    setFolderLeftRoot,
    folderRightRoot,
    setFolderRightRoot,
    folderNameFilter,
    setFolderNameFilter,
    folderCurrentPath,
    setFolderCurrentPath,
    folderResult,
    setFolderResult,
    folderStatus,
    setFolderStatus,
    folderRecentPairs,
    setFolderRecentPairs,
  } = state

  const viewState = useDirectoryCompareViewState({
    folderResult,
    folderLeftRoot,
    folderRightRoot,
    folderNameFilter,
    folderCurrentPath,
    compareFolders: deps.compareFolders,
    onFolderTreeLoadError: (error) => {
      const message = `Failed to load directory children: ${formatUnknownError(error)}`
      setFolderStatus(message)
      showErrorNotification('Failed to load directory', message)
    },
  })

  const {
    folderViewMode,
    setFolderViewMode,
    setSelectedFolderItemPath,
    sortedFolderItems,
    selectedFolderItem,
    toggleFolderTreeNode,
    resetFolderNavigationState,
  } = viewState

  const workflow = useDirectoryCompareWorkflow({
    isFolderMode: deps.mode === 'folder',
    folderLeftRoot,
    folderRightRoot,
    folderNameFilter,
    folderCurrentPath,
    folderResult,
    folderViewMode,
    pickFolderRoot: deps.pickFolderRoot,
    compareFolders: deps.compareFolders,
    setFolderLeftRoot,
    setFolderRightRoot,
    setFolderCurrentPath,
    setFolderResult,
    setFolderStatus,
    setFolderRecentPairs,
    setSelectedFolderItemPath,
    onDirectoryPickerUnavailable: () => {
      showErrorNotification('Directory picker unavailable', 'Directory picker is not available.')
    },
    onDirectoryPickerError: (message) => {
      showErrorNotification('Failed to pick directory', message)
    },
  })

  const childDiffOpeners = useFolderChildDiffOpeners({
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
    setMode: deps.setMode,
    onOpenJSONDiff: childDiffOpeners.openFolderJSONDiff,
    onOpenTextDiff: childDiffOpeners.openFolderTextDiff,
    onOpenChildDiffError: (message) => {
      showErrorNotification('Failed to open child diff', message)
    },
  })

  const interactions = useDirectoryCompareInteractions({
    compareFolders: deps.compareFolders,
    folderNameFilter,
    folderResult,
    sortedFolderItems,
    selectedFolderItem,
    resetFolderNavigationState,
    openFolderEntryDiff: childDiffActions.openFolderEntryDiff,
    toggleFolderTreeNode,
    setFolderLeftRoot,
    setFolderRightRoot,
    setFolderCurrentPath,
    setFolderViewMode,
    setSelectedFolderItemPath,
    setFolderResult,
    setFolderStatus,
    setFolderRecentPairs,
    setMode: deps.setMode,
  })

  const compareDisabled = !folderLeftRoot || !folderRightRoot

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

export type FolderCompareModel = ReturnType<typeof useFolderCompareModel>
