import type { TextEncoding } from '../types'

const ENCODING_OPTIONS: ReadonlyArray<{ value: TextEncoding; label: string }> = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'shift-jis', label: 'Shift-JIS' },
  { value: 'euc-jp', label: 'EUC-JP' },
  { value: 'utf-16-le', label: 'UTF-16 LE' },
  { value: 'utf-16-be', label: 'UTF-16 BE' },
  { value: 'iso-8859-1', label: 'ISO-8859-1' },
]

type EncodingSelectProps = {
  value: TextEncoding
  onChange: (value: TextEncoding) => void
  disabled?: boolean
  ariaLabel?: string
}

export function EncodingSelect({
  value,
  onChange,
  disabled = false,
  ariaLabel = 'File encoding',
}: EncodingSelectProps) {
  return (
    <select
      className="encoding-select"
      value={value}
      onChange={(event) => onChange(event.target.value as TextEncoding)}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {ENCODING_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
