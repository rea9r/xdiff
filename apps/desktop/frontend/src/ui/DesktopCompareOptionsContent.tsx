import { lazy, Suspense } from 'react'
import type { Mode } from '../types'
import type { JSONCompareOptionsPanelProps } from '../features/json/JSONCompareOptionsPanel'
import type { TextCompareOptionsPanelProps } from '../features/text/TextCompareOptionsPanel'

const JSONCompareOptionsPanel = lazy(() =>
  import('../features/json/JSONCompareOptionsPanel').then((module) => ({
    default: module.JSONCompareOptionsPanel,
  })),
)
const TextCompareOptionsPanel = lazy(() =>
  import('../features/text/TextCompareOptionsPanel').then((module) => ({
    default: module.TextCompareOptionsPanel,
  })),
)

type DesktopCompareOptionsContentProps = {
  mode: Mode
  jsonProps: JSONCompareOptionsPanelProps
  textProps: TextCompareOptionsPanelProps
}

export function DesktopCompareOptionsContent({
  mode,
  jsonProps,
  textProps,
}: DesktopCompareOptionsContentProps) {
  const fallback = <div className="muted">Loading options...</div>

  if (mode === 'json') {
    return (
      <Suspense fallback={fallback}>
        <JSONCompareOptionsPanel {...jsonProps} />
      </Suspense>
    )
  }

  if (mode === 'text') {
    return (
      <Suspense fallback={fallback}>
        <TextCompareOptionsPanel {...textProps} />
      </Suspense>
    )
  }

  return null
}
