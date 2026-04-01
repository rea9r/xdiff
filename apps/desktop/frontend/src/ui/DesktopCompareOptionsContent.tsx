import type { ComponentProps } from 'react'
import type { Mode } from '../types'
import { JSONCompareOptionsPanel } from '../features/json/JSONCompareOptionsPanel'
import { SpecCompareOptionsPanel } from '../features/spec/SpecCompareOptionsPanel'
import { TextCompareOptionsPanel } from '../features/text/TextCompareOptionsPanel'

type JSONCompareOptionsPanelProps = ComponentProps<typeof JSONCompareOptionsPanel>
type SpecCompareOptionsPanelProps = ComponentProps<typeof SpecCompareOptionsPanel>
type TextCompareOptionsPanelProps = ComponentProps<typeof TextCompareOptionsPanel>

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
  if (mode === 'json') {
    return <JSONCompareOptionsPanel {...jsonProps} />
  }

  if (mode === 'spec') {
    return <SpecCompareOptionsPanel {...specProps} />
  }

  if (mode === 'text') {
    return <TextCompareOptionsPanel {...textProps} />
  }

  return null
}
