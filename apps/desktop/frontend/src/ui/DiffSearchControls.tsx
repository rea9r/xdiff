import { ActionIcon, Tooltip } from '@mantine/core'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import type { KeyboardEventHandler, MutableRefObject } from 'react'

type DiffSearchControlsProps = {
  value: string
  placeholder: string
  statusText?: string | null
  onChange: (value: string) => void
  onPrev: () => void
  onNext: () => void
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
  disabled?: boolean
  prevDisabled?: boolean
  nextDisabled?: boolean
  inputRef?: MutableRefObject<HTMLInputElement | null>
}

export function DiffSearchControls({
  value,
  placeholder,
  statusText,
  onChange,
  onPrev,
  onNext,
  onKeyDown,
  disabled = false,
  prevDisabled = false,
  nextDisabled = false,
  inputRef,
}: DiffSearchControlsProps) {
  return (
    <>
      <input
        ref={inputRef}
        type="text"
        className="text-search-input"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />

      {statusText ? (
        <span className="muted text-search-status">{statusText}</span>
      ) : null}

      <Tooltip label="Previous match">
        <ActionIcon
          variant="default"
          size={28}
          aria-label="Previous match"
          className="text-search-action"
          onClick={onPrev}
          disabled={prevDisabled}
        >
          <IconChevronUp size={15} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Next match">
        <ActionIcon
          variant="default"
          size={28}
          aria-label="Next match"
          className="text-search-action"
          onClick={onNext}
          disabled={nextDisabled}
        >
          <IconChevronDown size={15} />
        </ActionIcon>
      </Tooltip>
    </>
  )
}
