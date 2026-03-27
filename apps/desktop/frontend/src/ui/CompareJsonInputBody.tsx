type CompareJsonInputBodyProps = {
  value: string
  onChange: (value: string) => void
  parseError?: string | null
}

export function CompareJsonInputBody({
  value,
  onChange,
  parseError = null,
}: CompareJsonInputBodyProps) {
  return (
    <div className="compare-json-input-body">
      <textarea
        className="text-editor compare-json-input-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {parseError ? <div className="compare-json-parse-error">Invalid JSON: {parseError}</div> : null}
    </div>
  )
}
