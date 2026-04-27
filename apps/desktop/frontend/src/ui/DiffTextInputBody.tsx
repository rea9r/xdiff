type DiffTextInputBodyProps = {
  value: string
  onChange: (value: string) => void
}

export function DiffTextInputBody({ value, onChange }: DiffTextInputBodyProps) {
  return (
    <textarea
      className="text-editor diff-text-input-body"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
