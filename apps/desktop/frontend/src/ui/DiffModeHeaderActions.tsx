import { Tooltip } from '@mantine/core'
import { IconAdjustmentsHorizontal, IconArrowsDiff } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { HeaderRailAction, HeaderRailGroup, HeaderRailPrimaryButton } from './HeaderRail'

type DiffModeHeaderActionsProps = {
  loading?: boolean
  diffDisabled?: boolean
  diffLabel?: string
  onDiff: () => void
  optionsOpen?: boolean
  onToggleOptions: () => void
  extraActions?: ReactNode
}

export function DiffModeHeaderActions({
  loading = false,
  diffDisabled = false,
  diffLabel = 'Compare',
  onDiff,
  optionsOpen = false,
  onToggleOptions,
  extraActions,
}: DiffModeHeaderActionsProps) {
  const optionsLabel = optionsOpen ? 'Hide diff options' : 'Show diff options'

  return (
    <HeaderRailGroup className="diff-mode-header-actions">
      <HeaderRailPrimaryButton
        onClick={onDiff}
        loading={loading}
        disabled={diffDisabled}
        leftSection={<IconArrowsDiff size={14} />}
      >
        {diffLabel}
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
