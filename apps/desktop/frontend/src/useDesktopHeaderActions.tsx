import { useCallback, useMemo } from 'react'
import type {
  CompareJSONRichResponse,
  DesktopRecentDirectoryPair,
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
  directoryCompareDisabled: boolean
  onRun: () => void
  jsonRecentPairs: DesktopRecentPair[]
  onClearJSONRecent: () => void
  textRecentPairs: DesktopRecentPair[]
  onClearTextRecent: () => void
  directoryRecentPairs: DesktopRecentDirectoryPair[]
  onClearDirectoryRecent: () => void
  runRecentAction: RecentActionRunner
  runTextFromRecent: (pair: DesktopRecentPair) => Promise<void>
  clearTextExpandedSections: () => void
  resetTextSearch: () => void
  runJSONFromRecent: (pair: DesktopRecentPair) => Promise<CompareJSONRichResponse>
  applyJSONResultView: (result: StructuredResultView) => void
  runDirectoryFromRecent: (entry: DesktopRecentDirectoryPair) => Promise<void>
  setMode: (value: Mode) => void
}

export function useDesktopHeaderActions({
  mode,
  loading,
  compareOptionsOpened,
  onToggleCompareOptions,
  jsonCompareDisabled,
  directoryCompareDisabled,
  onRun,
  jsonRecentPairs,
  onClearJSONRecent,
  textRecentPairs,
  onClearTextRecent,
  directoryRecentPairs,
  onClearDirectoryRecent,
  runRecentAction,
  runTextFromRecent,
  clearTextExpandedSections,
  resetTextSearch,
  runJSONFromRecent,
  applyJSONResultView,
  runDirectoryFromRecent,
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
              void runRecentAction('Recent JSON diff', () => runJSONFromRecentWithViewReset(pair)),
          }))
        : mode === 'text'
          ? textRecentPairs.map((pair) => ({
              key: `${pair.oldPath}::${pair.newPath}`,
              label: `${pair.oldPath} -> ${pair.newPath}`,
              onClick: () =>
                void runRecentAction('Recent Text diff', () => runTextFromRecentWithViewReset(pair)),
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

  const directoryRecentItems = useMemo(
    () =>
      directoryRecentPairs.map((entry) => ({
        key: `${entry.leftRoot}::${entry.rightRoot}::${entry.currentPath}::${entry.viewMode}`,
        label: `${entry.leftRoot} <> ${entry.rightRoot}`,
        onClick: () =>
          void runRecentAction('Recent directory diff', () => runDirectoryFromRecent(entry)),
      })),
    [directoryRecentPairs, runDirectoryFromRecent, runRecentAction],
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

    if (mode === 'directory') {
      return (
        <DesktopModeHeaderActions
          kind="directory"
          loading={loading}
          compareDisabled={directoryCompareDisabled}
          onCompare={() => void onRun()}
          recentItems={directoryRecentItems}
          onClearRecent={onClearDirectoryRecent}
        />
      )
    }

    return undefined
  }, [
    compareOptionsOpened,
    compareRecentItems,
    directoryCompareDisabled,
    directoryRecentItems,
    jsonCompareDisabled,
    loading,
    mode,
    onClearDirectoryRecent,
    onClearJSONRecent,
    onClearTextRecent,
    onRun,
    onToggleCompareOptions,
  ])

  return {
    headerActions,
  }
}
