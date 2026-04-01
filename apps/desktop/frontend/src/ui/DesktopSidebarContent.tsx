import type { ComponentProps } from 'react'
import type { Mode } from '../types'
import { ScenarioControlPanel } from '../features/scenario/ScenarioControlPanel'

type ScenarioControlPanelProps = ComponentProps<typeof ScenarioControlPanel>

type DesktopSidebarContentProps = {
  mode: Mode
  scenarioProps: ScenarioControlPanelProps
}

export function DesktopSidebarContent({
  mode,
  scenarioProps,
}: DesktopSidebarContentProps) {
  if (mode !== 'scenario') {
    return null
  }

  return <ScenarioControlPanel {...scenarioProps} />
}
