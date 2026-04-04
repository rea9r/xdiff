import { lazy, Suspense } from 'react'
import { IconArrowLeft } from '@tabler/icons-react'
import type { Mode } from '../types'
import { CompareWorkspaceShell } from './CompareWorkspaceShell'
import type { DirectoryCompareResultPanelProps } from '../features/folder/DirectoryCompareResultPanel'
import type { TextCompareResultPanelProps } from '../features/text/TextCompareResultPanel'
import type { TextCompareSourceWorkspaceProps } from '../features/text/TextCompareSourceWorkspace'
import type { JSONCompareResultPanelProps } from '../features/json/JSONCompareResultPanel'
import type { JSONCompareSourceWorkspaceProps } from '../features/json/JSONCompareSourceWorkspace'
import type { SpecCompareResultPanelProps } from '../features/spec/SpecCompareResultPanel'
import type { SpecCompareSourceWorkspaceProps } from '../features/spec/SpecCompareSourceWorkspace'
import type { ScenarioResultPanelProps } from '../features/scenario/ScenarioResultPanel'

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
const SpecCompareResultPanel = lazy(() =>
  import('../features/spec/SpecCompareResultPanel').then((module) => ({
    default: module.SpecCompareResultPanel,
  })),
)
const SpecCompareSourceWorkspace = lazy(() =>
  import('../features/spec/SpecCompareSourceWorkspace').then((module) => ({
    default: module.SpecCompareSourceWorkspace,
  })),
)
const ScenarioResultPanel = lazy(() =>
  import('../features/scenario/ScenarioResultPanel').then((module) => ({
    default: module.ScenarioResultPanel,
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
  specSourceProps: SpecCompareSourceWorkspaceProps
  specResultProps: SpecCompareResultPanelProps
  folderResultProps: DirectoryCompareResultPanelProps
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
  specSourceProps,
  specResultProps,
  folderResultProps,
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

  if (mode === 'spec') {
    return (
      <div className="compare-main-shell">
        {folderReturnPathBanner}
        <Suspense fallback={<MainContentLoadingFallback />}>
          <CompareWorkspaceShell
            source={<SpecCompareSourceWorkspace {...specSourceProps} />}
            result={<SpecCompareResultPanel {...specResultProps} />}
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
    <div className="result-panel">
      <h2>Result</h2>
      <Suspense fallback={<MainContentLoadingFallback />}>
        <ScenarioResultPanel {...scenarioResultProps} />
      </Suspense>
    </div>
  )
}
