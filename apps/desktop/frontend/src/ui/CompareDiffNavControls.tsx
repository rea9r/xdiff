import { ActionIcon, Tooltip } from '@mantine/core'
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react'

type CompareDiffNavControlsProps = {
  count: number
  activeIndex: number
  onPrev: () => void
  onNext: () => void
  disabled?: boolean
}

export function CompareDiffNavControls({
  count,
  activeIndex,
  onPrev,
  onNext,
  disabled = false,
}: CompareDiffNavControlsProps) {
  const hasDiffs = count > 0
  const statusText = hasDiffs ? `${activeIndex + 1} / ${count}` : '0 diffs'
  const navDisabled = disabled || !hasDiffs

  return (
    <>
      <span className="muted text-search-status">{statusText}</span>

      <Tooltip label="Previous diff (Alt+↑)">
        <ActionIcon
          variant="default"
          size={28}
          aria-label="Previous diff"
          className="text-search-action"
          onClick={onPrev}
          disabled={navDisabled}
        >
          <IconArrowUp size={15} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Next diff (Alt+↓)">
        <ActionIcon
          variant="default"
          size={28}
          aria-label="Next diff"
          className="text-search-action"
          onClick={onNext}
          disabled={navDisabled}
        >
          <IconArrowDown size={15} />
        </ActionIcon>
      </Tooltip>
    </>
  )
}
