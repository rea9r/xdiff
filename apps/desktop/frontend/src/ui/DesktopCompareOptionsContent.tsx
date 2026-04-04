import { lazy, Suspense } from 'react'
import type { Mode } from '../types'
import type { JSONCompareOptionsPanelProps } from '../features/json/JSONCompareOptionsPanel'
import type { SpecCompareOptionsPanelProps } from '../features/spec/SpecCompareOptionsPanel'
import type { TextCompareOptionsPanelProps } from '../features/text/TextCompareOptionsPanel'

const JSONCompareOptionsPanel = lazy(() =>
  import('../features/json/JSONCompareOptionsPanel').then((module) => ({
    default: module.JSONCompareOptionsPanel,
  })),
)
const SpecCompareOptionsPanel = lazy(() =>
  import('../features/spec/SpecCompareOptionsPanel').then((module) => ({
    default: module.SpecCompareOptionsPanel,
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
  specProps: SpecCompareOptionsPanelProps
  textProps: TextCompareOptionsPanelProps
}

export function DesktopCompareOptionsContent({
  mode,
  jsonProps,
  specProps,
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

  if (mode === 'spec') {
    return (
      <Suspense fallback={fallback}>
        <SpecCompareOptionsPanel {...specProps} />
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
