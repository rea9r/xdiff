import { lazy, Suspense } from 'react'
import { IconArrowLeft } from '@tabler/icons-react'
import type { Mode } from '../types'
import { CompareWorkspaceShell } from './CompareWorkspaceShell'
import type { DirectoryCompareResultPanelProps } from '../features/folder/DirectoryCompareResultPanel'
import type { TextCompareResultPanelProps } from '../features/text/TextCompareResultPanel'
import type { TextCompareSourceWorkspaceProps } from '../features/text/TextCompareSourceWorkspace'
import type { JSONCompareResultPanelProps } from '../features/json/JSONCompareResultPanel'
import type { JSONCompareSourceWorkspaceProps } from '../features/json/JSONCompareSourceWorkspace'
import type { ScenarioResultPanelProps } from '../features/scenario/ScenarioResultPanel'
import type { ScenarioSourceWorkspaceProps } from '../features/scenario/ScenarioSourceWorkspace'

const DirectoryCompareResultPanel = lazy(() =>
  import('../features/folder/DirectoryCompareResultPanel').then((module) => ({
    default: module.DirectoryCompareResultPanel,
  })),
)
const TextCompareResultPanel = lazy(() =>
  import('../features/text/TextCompareResultPanel').then((module) => ({
    default: module.TextCompareResultPanel,
  })),
)
const TextCompareSourceWorkspace = lazy(() =>
  import('../features/text/TextCompareSourceWorkspace').then((module) => ({
    default: module.TextCompareSourceWorkspace,
  })),
)
const JSONCompareResultPanel = lazy(() =>
  import('../features/json/JSONCompareResultPanel').then((module) => ({
    default: module.JSONCompareResultPanel,
  })),
)
const JSONCompareSourceWorkspace = lazy(() =>
  import('../features/json/JSONCompareSourceWorkspace').then((module) => ({
    default: module.JSONCompareSourceWorkspace,
  })),
)
const ScenarioResultPanel = lazy(() =>
  import('../features/scenario/ScenarioResultPanel').then((module) => ({
    default: module.ScenarioResultPanel,
  })),
)
const ScenarioSourceWorkspace = lazy(() =>
  import('../features/scenario/ScenarioSourceWorkspace').then((module) => ({
    default: module.ScenarioSourceWorkspace,
  })),
)

function MainContentLoadingFallback() {
  return <div className="muted">Loading view...</div>
}

type DesktopMainContentProps = {
  mode: Mode
  showFolderReturnBanner: boolean
  onReturnToFolderCompare: () => void
  textSourceProps: TextCompareSourceWorkspaceProps
  textResultProps: TextCompareResultPanelProps
  jsonSourceProps: JSONCompareSourceWorkspaceProps
  jsonResultProps: JSONCompareResultPanelProps
  folderResultProps: DirectoryCompareResultPanelProps
  scenarioSourceProps: ScenarioSourceWorkspaceProps
  scenarioResultProps: ScenarioResultPanelProps
}

export function DesktopMainContent({
  mode,
  showFolderReturnBanner,
  onReturnToFolderCompare,
  textSourceProps,
  textResultProps,
  jsonSourceProps,
  jsonResultProps,
  folderResultProps,
  scenarioSourceProps,
  scenarioResultProps,
}: DesktopMainContentProps) {
  const folderReturnPathBanner = showFolderReturnBanner ? (
    <div className="folder-return-banner">
      <button
        type="button"
        className="button-secondary button-compact folder-return-button"
        onClick={onReturnToFolderCompare}
      >
        <IconArrowLeft size={13} />
        Back to directory compare
      </button>
    </div>
  ) : null

  if (mode === 'text') {
    return (
      <div className="compare-main-shell">
        {folderReturnPathBanner}
        <Suspense fallback={<MainContentLoadingFallback />}>
          <CompareWorkspaceShell
            source={<TextCompareSourceWorkspace {...textSourceProps} />}
            result={<TextCompareResultPanel {...textResultProps} />}
          />
        </Suspense>
      </div>
    )
  }

  if (mode === 'json') {
    return (
      <div className="compare-main-shell">
        {folderReturnPathBanner}
        <Suspense fallback={<MainContentLoadingFallback />}>
          <CompareWorkspaceShell
            source={<JSONCompareSourceWorkspace {...jsonSourceProps} />}
            result={<JSONCompareResultPanel {...jsonResultProps} />}
          />
        </Suspense>
      </div>
    )
  }

  if (mode === 'folder') {
    return (
      <div className="result-panel">
        <Suspense fallback={<MainContentLoadingFallback />}>
          <DirectoryCompareResultPanel {...folderResultProps} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="compare-main-shell">
      <Suspense fallback={<MainContentLoadingFallback />}>
        <CompareWorkspaceShell
          source={<ScenarioSourceWorkspace {...scenarioSourceProps} />}
          result={<ScenarioResultPanel {...scenarioResultProps} />}
        />
      </Suspense>
    </div>
  )
}
