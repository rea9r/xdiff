import { AppShell, Box, Burger, Group, ScrollArea, Select, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { ReactNode } from 'react'
import type { Mode } from '../types'
import { ThemeModeControl } from './ThemeModeControl'

type AppChromeProps = {
  mode: Mode
  onModeChange: (mode: Mode) => void
  sidebar: ReactNode
  main: ReactNode
}

const MODE_OPTIONS = [
  { value: 'json', label: 'JSON compare' },
  { value: 'spec', label: 'OpenAPI spec compare' },
  { value: 'text', label: 'Text compare' },
  { value: 'folder', label: 'Folder compare' },
  { value: 'scenario', label: 'Scenario run' },
]

export function AppChrome({ mode, onModeChange, sidebar, main }: AppChromeProps) {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false)

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 320,
        breakpoint: 'md',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group justify="space-between" h="100%" px="md">
          <Group gap="sm">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle navigation"
            />
            <Text fw={700}>xdiff Desktop</Text>
            <Select
              w={200}
              data={MODE_OPTIONS}
              value={mode}
              onChange={(value) => {
                if (!value) {
                  return
                }
                onModeChange(value as Mode)
                closeMobile()
              }}
            />
          </Group>
          <ThemeModeControl />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          <Box pr="xs" className="control-panel">
            {sidebar}
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{main}</AppShell.Main>
    </AppShell>
  )
}
