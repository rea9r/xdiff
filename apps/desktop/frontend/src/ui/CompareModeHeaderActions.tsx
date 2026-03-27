import { Tooltip } from '@mantine/core'
import { IconAdjustmentsHorizontal } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { HeaderRailAction, HeaderRailGroup, HeaderRailPrimaryButton } from './HeaderRail'

type CompareModeHeaderActionsProps = {
  loading?: boolean
  compareDisabled?: boolean
  compareLabel?: string
  onCompare: () => void
  optionsOpen?: boolean
  onToggleOptions: () => void
  extraActions?: ReactNode
}

export function CompareModeHeaderActions({
  loading = false,
  compareDisabled = false,
  compareLabel = 'Compare',
  onCompare,
  optionsOpen = false,
  onToggleOptions,
  extraActions,
}: CompareModeHeaderActionsProps) {
  const optionsLabel = optionsOpen ? 'Hide compare options' : 'Show compare options'

  return (
    <HeaderRailGroup className="compare-mode-header-actions">
      <HeaderRailPrimaryButton onClick={onCompare} loading={loading} disabled={compareDisabled}>
        {compareLabel}
      </HeaderRailPrimaryButton>
      <Tooltip label={optionsLabel}>
        <HeaderRailAction
          variant={optionsOpen ? 'filled' : 'default'}
          aria-label={optionsLabel}
          onClick={onToggleOptions}
        >
          <IconAdjustmentsHorizontal size={14} />
        </HeaderRailAction>
      </Tooltip>
      {extraActions}
    </HeaderRailGroup>
  )
}
