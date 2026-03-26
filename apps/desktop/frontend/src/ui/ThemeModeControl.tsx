import { Tooltip, useMantineColorScheme } from '@mantine/core'
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react'
import {
  HEADER_RAIL_ICON_SIZE,
  HeaderRailToggleIcon,
} from './HeaderRail'

export function ThemeModeControl() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()

  return (
    <div className="xdiff-theme-toggle-shell">
      <Tooltip label="Follow system theme">
        <div>
          <HeaderRailToggleIcon
            active={colorScheme === 'auto'}
            onClick={() => setColorScheme('auto')}
            label="Follow system theme"
            activeVariant="light"
            activeColor="gray"
            className="xdiff-theme-toggle-button"
          >
            <IconDeviceDesktop size={HEADER_RAIL_ICON_SIZE} />
          </HeaderRailToggleIcon>
        </div>
      </Tooltip>

      <span className="xdiff-theme-toggle-divider" aria-hidden="true" />

      <Tooltip label="Light theme">
        <div>
          <HeaderRailToggleIcon
            active={colorScheme === 'light'}
            onClick={() => setColorScheme('light')}
            label="Light theme"
            activeVariant="light"
            activeColor="gray"
            className="xdiff-theme-toggle-button"
          >
            <IconSun size={HEADER_RAIL_ICON_SIZE} />
          </HeaderRailToggleIcon>
        </div>
      </Tooltip>

      <span className="xdiff-theme-toggle-divider" aria-hidden="true" />

      <Tooltip label="Dark theme">
        <div>
          <HeaderRailToggleIcon
            active={colorScheme === 'dark'}
            onClick={() => setColorScheme('dark')}
            label="Dark theme"
            activeVariant="light"
            activeColor="gray"
            className="xdiff-theme-toggle-button"
          >
            <IconMoon size={HEADER_RAIL_ICON_SIZE} />
          </HeaderRailToggleIcon>
        </div>
      </Tooltip>
    </div>
  )
}
