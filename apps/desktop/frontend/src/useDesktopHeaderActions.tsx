import { useCallback, useMemo } from 'react'
import type {
  CompareJSONRichResponse,
  DesktopRecentFolderPair,
  DesktopRecentPair,
  Mode,
} from './types'
import { DesktopModeHeaderActions } from './ui/DesktopModeHeaderActions'

type RecentActionRunner = (label: string, action: () => Promise<void>) => Promise<void>

type StructuredResultView = Pick<CompareJSONRichResponse, 'result' | 'diffText'>

type UseDesktopHeaderActionsOptions = {
  mode: Mode
  loading: boolean
  compareOptionsOpened: boolean
  onToggleCompareOptions: () => void
  jsonCompareDisabled: boolean
  folderCompareDisabled: boolean
  onRun: () => void
  jsonRecentPairs: DesktopRecentPair[]
  onClearJSONRecent: () => void
  textRecentPairs: DesktopRecentPair[]
  onClearTextRecent: () => void
  folderRecentPairs: DesktopRecentFolderPair[]
  onClearFolderRecent: () => void
  runRecentAction: RecentActionRunner
  runTextFromRecent: (pair: DesktopRecentPair) => Promise<void>
  clearTextExpandedSections: () => void
  resetTextSearch: () => void
  runJSONFromRecent: (pair: DesktopRecentPair) => Promise<CompareJSONRichResponse>
  applyJSONResultView: (result: StructuredResultView) => void
  runFolderFromRecent: (entry: DesktopRecentFolderPair) => Promise<void>
  setMode: (value: Mode) => void
}

export function useDesktopHeaderActions({
  mode,
  loading,
  compareOptionsOpened,
  onToggleCompareOptions,
  jsonCompareDisabled,
  folderCompareDisabled,
  onRun,
  jsonRecentPairs,
  onClearJSONRecent,
  textRecentPairs,
  onClearTextRecent,
  folderRecentPairs,
  onClearFolderRecent,
  runRecentAction,
  runTextFromRecent,
  clearTextExpandedSections,
  resetTextSearch,
  runJSONFromRecent,
  applyJSONResultView,
  runFolderFromRecent,
  setMode,
}: UseDesktopHeaderActionsOptions) {
  const runTextFromRecentWithViewReset = useCallback(
    async (pair: DesktopRecentPair) => {
      await runTextFromRecent(pair)
      clearTextExpandedSections()
      resetTextSearch()
    },
    [clearTextExpandedSections, resetTextSearch, runTextFromRecent],
  )

  const runJSONFromRecentWithViewReset = useCallback(
    async (pair: DesktopRecentPair) => {
      const richResult = await runJSONFromRecent(pair)
      applyJSONResultView(richResult)
      setMode('json')
    },
    [applyJSONResultView, runJSONFromRecent, setMode],
  )

  const compareRecentItems = useMemo(
    () =>
      mode === 'json'
        ? jsonRecentPairs.map((pair) => ({
            key: `${pair.oldPath}::${pair.newPath}`,
            label: `${pair.oldPath} -> ${pair.newPath}`,
            onClick: () =>
              void runRecentAction('Recent JSON compare', () => runJSONFromRecentWithViewReset(pair)),
          }))
        : mode === 'text'
          ? textRecentPairs.map((pair) => ({
              key: `${pair.oldPath}::${pair.newPath}`,
              label: `${pair.oldPath} -> ${pair.newPath}`,
              onClick: () =>
                void runRecentAction('Recent Text compare', () => runTextFromRecentWithViewReset(pair)),
            }))
          : [],
    [
      jsonRecentPairs,
      mode,
      runJSONFromRecentWithViewReset,
      runRecentAction,
      runTextFromRecentWithViewReset,
      textRecentPairs,
    ],
  )

  const folderRecentItems = useMemo(
    () =>
      folderRecentPairs.map((entry) => ({
        key: `${entry.leftRoot}::${entry.rightRoot}::${entry.currentPath}::${entry.viewMode}`,
        label: `${entry.leftRoot} <> ${entry.rightRoot}`,
        onClick: () =>
          void runRecentAction('Recent directory compare', () => runFolderFromRecent(entry)),
      })),
    [folderRecentPairs, runFolderFromRecent, runRecentAction],
  )

  const headerActions = useMemo(() => {
    if (mode === 'json' || mode === 'text') {
      return (
        <DesktopModeHeaderActions
          kind="compare"
          loading={loading}
          compareDisabled={mode === 'json' ? jsonCompareDisabled : false}
          onCompare={() => void onRun()}
          optionsOpen={compareOptionsOpened}
          onToggleOptions={onToggleCompareOptions}
          recentItems={compareRecentItems}
          onClearRecent={mode === 'json' ? onClearJSONRecent : onClearTextRecent}
        />
      )
    }

    if (mode === 'folder') {
      return (
        <DesktopModeHeaderActions
          kind="folder"
          loading={loading}
          compareDisabled={folderCompareDisabled}
          onCompare={() => void onRun()}
          recentItems={folderRecentItems}
          onClearRecent={onClearFolderRecent}
        />
      )
    }

    return undefined
  }, [
    compareOptionsOpened,
    compareRecentItems,
    folderCompareDisabled,
    folderRecentItems,
    jsonCompareDisabled,
    loading,
    mode,
    onClearFolderRecent,
    onClearJSONRecent,
    onClearTextRecent,
    onRun,
    onToggleCompareOptions,
  ])

  return {
    headerActions,
  }
}
