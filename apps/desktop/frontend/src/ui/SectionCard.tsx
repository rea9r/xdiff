import { Card, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

type SectionCardProps = {
  title?: string
  children: ReactNode
}

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
        {title ? <Text fw={600}>{title}</Text> : null}
        {children}
      </Stack>
    </Card>
  )
}
