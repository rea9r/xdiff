import {
  ActionIcon,
  Menu,
  Tooltip,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core'
import {
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from '@tabler/icons-react'
import { HEADER_RAIL_HEIGHT, HEADER_RAIL_ICON_SIZE } from './HeaderRail'

type ThemeOption = {
  value: MantineColorScheme
  label: string
  Icon: typeof IconSun
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'auto', label: 'System', Icon: IconDeviceDesktop },
  { value: 'light', label: 'Light', Icon: IconSun },
  { value: 'dark', label: 'Dark', Icon: IconMoon },
]

function renderMenuCheck(active: boolean) {
  return active ? (
    <IconCheck size={14} className="menu-check-icon is-active" />
  ) : (
    <span className="menu-check-slot" aria-hidden="true" />
  )
}

export function ThemeModeControl() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const current = THEME_OPTIONS.find((option) => option.value === colorScheme) ?? THEME_OPTIONS[0]
  const CurrentIcon = current.Icon

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label={`Theme: ${current.label}`}>
          <ActionIcon
            variant="default"
            size={HEADER_RAIL_HEIGHT}
            radius="md"
            aria-label="Change theme"
          >
            <CurrentIcon size={HEADER_RAIL_ICON_SIZE} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Theme</Menu.Label>
        {THEME_OPTIONS.map((option) => {
          const OptionIcon = option.Icon
          return (
            <Menu.Item
              key={option.value}
              leftSection={renderMenuCheck(option.value === colorScheme)}
              rightSection={<OptionIcon size={14} />}
              onClick={() => setColorScheme(option.value)}
            >
              {option.label}
            </Menu.Item>
          )
        })}
      </Menu.Dropdown>
    </Menu>
  )
}
