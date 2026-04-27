import { lazy, Suspense } from 'react'
import type { Mode } from '../types'
import type { JSONDiffOptionsPanelProps } from '../features/json/JSONDiffOptionsPanel'
import type { TextDiffOptionsPanelProps } from '../features/text/TextDiffOptionsPanel'

const JSONDiffOptionsPanel = lazy(() =>
  import('../features/json/JSONDiffOptionsPanel').then((module) => ({
    default: module.JSONDiffOptionsPanel,
  })),
)
const TextDiffOptionsPanel = lazy(() =>
  import('../features/text/TextDiffOptionsPanel').then((module) => ({
    default: module.TextDiffOptionsPanel,
  })),
)

type DesktopDiffOptionsContentProps = {
  mode: Mode
  jsonProps: JSONDiffOptionsPanelProps
  textProps: TextDiffOptionsPanelProps
}

export function DesktopDiffOptionsContent({
  mode,
  jsonProps,
  textProps,
}: DesktopDiffOptionsContentProps) {
  const fallback = <div className="muted">Loading options...</div>

  if (mode === 'json') {
    return (
      <Suspense fallback={fallback}>
        <JSONDiffOptionsPanel {...jsonProps} />
      </Suspense>
    )
  }

  if (mode === 'text') {
    return (
      <Suspense fallback={fallback}>
        <TextDiffOptionsPanel {...textProps} />
      </Suspense>
    )
  }

  return null
}
