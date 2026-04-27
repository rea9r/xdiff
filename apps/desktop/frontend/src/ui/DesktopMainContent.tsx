import { lazy, Suspense } from 'react'
import { IconArrowLeft } from '@tabler/icons-react'
import type { Mode } from '../types'
import { DiffWorkspaceShell } from './DiffWorkspaceShell'
import type { DirectoryDiffResultPanelProps } from '../features/directory/DirectoryDiffResultPanel'
import type { TextDiffResultPanelProps } from '../features/text/TextDiffResultPanel'
import type { TextDiffSourceWorkspaceProps } from '../features/text/TextDiffSourceWorkspace'
import type { JSONDiffResultPanelProps } from '../features/json/JSONDiffResultPanel'
import type { JSONDiffSourceWorkspaceProps } from '../features/json/JSONDiffSourceWorkspace'

const DirectoryDiffResultPanel = lazy(() =>
  import('../features/directory/DirectoryDiffResultPanel').then((module) => ({
    default: module.DirectoryDiffResultPanel,
  })),
)
const TextDiffResultPanel = lazy(() =>
  import('../features/text/TextDiffResultPanel').then((module) => ({
    default: module.TextDiffResultPanel,
  })),
)
const TextDiffSourceWorkspace = lazy(() =>
  import('../features/text/TextDiffSourceWorkspace').then((module) => ({
    default: module.TextDiffSourceWorkspace,
  })),
)
const JSONDiffResultPanel = lazy(() =>
  import('../features/json/JSONDiffResultPanel').then((module) => ({
    default: module.JSONDiffResultPanel,
  })),
)
const JSONDiffSourceWorkspace = lazy(() =>
  import('../features/json/JSONDiffSourceWorkspace').then((module) => ({
    default: module.JSONDiffSourceWorkspace,
  })),
)

function MainContentLoadingFallback() {
  return <div className="muted">Loading view...</div>
}

type DesktopMainContentProps = {
  mode: Mode
  showDirectoryReturnBanner: boolean
  onReturnToDirectoryDiff: () => void
  textSourceProps: TextDiffSourceWorkspaceProps
  textResultProps: TextDiffResultPanelProps
  jsonSourceProps: JSONDiffSourceWorkspaceProps
  jsonResultProps: JSONDiffResultPanelProps
  directoryResultProps: DirectoryDiffResultPanelProps
}

export function DesktopMainContent({
  mode,
  showDirectoryReturnBanner,
  onReturnToDirectoryDiff,
  textSourceProps,
  textResultProps,
  jsonSourceProps,
  jsonResultProps,
  directoryResultProps,
}: DesktopMainContentProps) {
  const directoryReturnPathBanner = showDirectoryReturnBanner ? (
    <div className="directory-return-banner">
      <button
        type="button"
        className="button-secondary button-compact directory-return-button"
        onClick={onReturnToDirectoryDiff}
      >
        <IconArrowLeft size={13} />
        Back to directory diff
      </button>
    </div>
  ) : null

  if (mode === 'text') {
    return (
      <div className="diff-main-shell">
        {directoryReturnPathBanner}
        <Suspense fallback={<MainContentLoadingFallback />}>
          <DiffWorkspaceShell
            source={<TextDiffSourceWorkspace {...textSourceProps} />}
            result={<TextDiffResultPanel {...textResultProps} />}
          />
        </Suspense>
      </div>
    )
  }

  if (mode === 'json') {
    return (
      <div className="diff-main-shell">
        {directoryReturnPathBanner}
        <Suspense fallback={<MainContentLoadingFallback />}>
          <DiffWorkspaceShell
            source={<JSONDiffSourceWorkspace {...jsonSourceProps} />}
            result={<JSONDiffResultPanel {...jsonResultProps} />}
          />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="result-panel">
      <Suspense fallback={<MainContentLoadingFallback />}>
        <DirectoryDiffResultPanel {...directoryResultProps} />
      </Suspense>
    </div>
  )
}
