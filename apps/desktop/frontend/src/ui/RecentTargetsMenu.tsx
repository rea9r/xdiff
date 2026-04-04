import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { ActionIcon, Menu, Tooltip } from '@mantine/core'
import { IconHistory } from '@tabler/icons-react'

export type RecentTargetsMenuItem = {
  key: string
  label: string
  onClick: () => void
}

type RecentTargetsMenuProps = {
  buttonLabel: string
  disabled?: boolean
  items: RecentTargetsMenuItem[]
  clearLabel?: string
  onClear: () => void
}

type RecentMenuIconButtonProps = ComponentPropsWithoutRef<'button'> & {
  label: string
}

const RecentMenuIconButton = forwardRef<HTMLButtonElement, RecentMenuIconButtonProps>(
  ({ label, ...props }, ref) => (
    <Tooltip label={label}>
      <ActionIcon ref={ref} {...props} variant="default" size={28} radius="md" aria-label={props['aria-label'] ?? label}>
        <IconHistory size={14} />
      </ActionIcon>
    </Tooltip>
  ),
)

RecentMenuIconButton.displayName = 'RecentMenuIconButton'

export function RecentTargetsMenu({
  buttonLabel,
  disabled = false,
  items,
  clearLabel = 'Clear recent',
  onClear,
}: RecentTargetsMenuProps) {
  return (
    <Menu position="bottom-end" withinPortal closeOnClickOutside closeOnEscape>
      <Menu.Target>
        <RecentMenuIconButton label={buttonLabel} disabled={disabled} />
      </Menu.Target>
      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item key={item.key} onClick={item.onClick}>
            {item.label}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item color="red" onClick={onClear}>
          {clearLabel}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
