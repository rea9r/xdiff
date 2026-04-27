import {
  ActionIcon,
  Button,
  Group,
  Select,
} from '@mantine/core'
import type { ReactNode } from 'react'

export const HEADER_RAIL_HEIGHT = 28
export const HEADER_RAIL_ICON_SIZE = 14

export function HeaderRailGroup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Group gap="var(--xdiff-header-gap)" align="center" className={className}>
      {children}
    </Group>
  )
}

export function HeaderRailSelect(props: any) {
  return (
    <Select
      {...props}
      styles={{
        input: {
          height: HEADER_RAIL_HEIGHT,
          minHeight: HEADER_RAIL_HEIGHT,
          borderRadius: 'var(--xdiff-header-control-radius)',
        },
      }}
    />
  )
}

export function HeaderRailPrimaryButton(props: any) {
  return (
    <Button
      {...props}
      size="compact-xs"
      styles={{
        root: {
          height: HEADER_RAIL_HEIGHT,
          minHeight: HEADER_RAIL_HEIGHT,
          borderRadius: 'var(--xdiff-header-control-radius)',
        },
      }}
    />
  )
}

export function HeaderRailAction(props: any) {
  return (
    <ActionIcon
      {...props}
      variant={props.variant ?? 'default'}
      size={HEADER_RAIL_HEIGHT}
      radius="md"
    />
  )
}

