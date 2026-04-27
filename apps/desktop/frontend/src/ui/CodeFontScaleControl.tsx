import { ActionIcon, Menu, Tooltip } from '@mantine/core'
import { IconCheck, IconTextSize } from '@tabler/icons-react'
import {
  formatCodeFontScalePercent,
  useCodeFontScale,
} from '../useCodeFontScale'
import { HEADER_RAIL_HEIGHT, HEADER_RAIL_ICON_SIZE } from './HeaderRail'

function renderMenuCheck(active: boolean) {
  return active ? (
    <IconCheck size={14} className="menu-check-icon is-active" />
  ) : (
    <span className="menu-check-slot" aria-hidden="true" />
  )
}

export function CodeFontScaleControl() {
  const { scale, presets, setScale, reset } = useCodeFontScale()
  const tooltip = `Code font size: ${formatCodeFontScalePercent(scale)}`

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label={tooltip}>
          <ActionIcon
            variant="default"
            size={HEADER_RAIL_HEIGHT}
            radius="md"
            aria-label="Change code font size"
          >
            <IconTextSize size={HEADER_RAIL_ICON_SIZE} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Code font size</Menu.Label>
        {presets.map((preset) => (
          <Menu.Item
            key={preset}
            leftSection={renderMenuCheck(Math.abs(scale - preset) < 0.001)}
            onClick={() => setScale(preset)}
          >
            {formatCodeFontScalePercent(preset)}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item onClick={reset}>Reset to 100%</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
