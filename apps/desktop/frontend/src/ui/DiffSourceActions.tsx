import { ActionIcon, Tooltip } from '@mantine/core'
import type { MouseEvent, ReactNode } from 'react'

export const DIFF_PANE_ACTION_SIZE = 26

type DiffPaneActionProps = {
  label: string
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  loading?: boolean
  danger?: boolean
  children: ReactNode
}

type DiffPaneActionsProps = {
  children: ReactNode
}

export function DiffPaneActions({ children }: DiffPaneActionsProps) {
  return <div className="diff-pane-actions">{children}</div>
}

export function DiffPaneAction({
  label,
  onClick,
  disabled,
  loading,
  danger = false,
  children,
}: DiffPaneActionProps) {
  return (
    <Tooltip label={label}>
      <ActionIcon
        variant="default"
        size={DIFF_PANE_ACTION_SIZE}
        aria-label={label}
        className={`diff-pane-action ${danger ? 'is-danger' : ''}`}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
      >
        {children}
      </ActionIcon>
    </Tooltip>
  )
}
