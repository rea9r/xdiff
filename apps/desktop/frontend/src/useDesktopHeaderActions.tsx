import { useCallback, useMemo } from 'react'
import type {
  DiffJSONRichResponse,
  DesktopRecentDirectoryPair,
  DesktopRecentPair,
  Mode,
} from './types'
import { DesktopModeHeaderActions } from './ui/DesktopModeHeaderActions'

type RecentActionRunner = (label: string, action: () => Promise<void>) => Promise<void>

type StructuredResultView = Pick<DiffJSONRichResponse, 'result' | 'diffText'>

type UseDesktopHeaderActionsOptions = {
  mode: Mode
  loading: boolean
  diffOptionsOpened: boolean
  onToggleDiffOptions: () => void
  jsonDiffDisabled: boolean
  directoryDiffDisabled: boolean
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
  runJSONFromRecent: (pair: DesktopRecentPair) => Promise<DiffJSONRichResponse>
  applyJSONResultView: (result: StructuredResultView) => void
  runDirectoryFromRecent: (entry: DesktopRecentDirectoryPair) => Promise<void>
  setMode: (value: Mode) => void
}

export function useDesktopHeaderActions({
  mode,
  loading,
  diffOptionsOpened,
  onToggleDiffOptions,
  jsonDiffDisabled,
  directoryDiffDisabled,
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

  const diffRecentItems = useMemo(
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
          kind="diff"
          loading={loading}
          diffDisabled={mode === 'json' ? jsonDiffDisabled : false}
          onDiff={() => void onRun()}
          optionsOpen={diffOptionsOpened}
          onToggleOptions={onToggleDiffOptions}
          recentItems={diffRecentItems}
          onClearRecent={mode === 'json' ? onClearJSONRecent : onClearTextRecent}
        />
      )
    }

    if (mode === 'directory') {
      return (
        <DesktopModeHeaderActions
          kind="directory"
          loading={loading}
          diffDisabled={directoryDiffDisabled}
          onDiff={() => void onRun()}
          recentItems={directoryRecentItems}
          onClearRecent={onClearDirectoryRecent}
        />
      )
    }

    return undefined
  }, [
    diffOptionsOpened,
    diffRecentItems,
    directoryDiffDisabled,
    directoryRecentItems,
    jsonDiffDisabled,
    loading,
    mode,
    onClearDirectoryRecent,
    onClearJSONRecent,
    onClearTextRecent,
    onRun,
    onToggleDiffOptions,
  ])

  return {
    headerActions,
  }
}
