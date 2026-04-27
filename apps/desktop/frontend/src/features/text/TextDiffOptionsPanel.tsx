export type TextDiffOptionsPanelProps = {
  outputFormat: string
  onOutputFormatChange: (value: string) => void
  ignoreWhitespace: boolean
  onIgnoreWhitespaceChange: (checked: boolean) => void
  ignoreCase: boolean
  onIgnoreCaseChange: (checked: boolean) => void
  ignoreEOL: boolean
  onIgnoreEOLChange: (checked: boolean) => void
}

export function TextDiffOptionsPanel({
  outputFormat,
  onOutputFormatChange,
  ignoreWhitespace,
  onIgnoreWhitespaceChange,
  ignoreCase,
  onIgnoreCaseChange,
  ignoreEOL,
  onIgnoreEOLChange,
}: TextDiffOptionsPanelProps) {
  return (
    <section className="mode-panel">
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={ignoreWhitespace}
          onChange={(e) => onIgnoreWhitespaceChange(e.target.checked)}
        />
        ignore whitespace
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={ignoreCase}
          onChange={(e) => onIgnoreCaseChange(e.target.checked)}
        />
        ignore case
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={ignoreEOL}
          onChange={(e) => onIgnoreEOLChange(e.target.checked)}
        />
        ignore EOL (CRLF/CR → LF)
      </label>

      <section className="options-panel">
        <h3>Options</h3>

        <div className="field-block">
          <label className="field-label">Output format</label>
          <select value={outputFormat} onChange={(e) => onOutputFormatChange(e.target.value)}>
            <option value="text">text</option>
            <option value="json">json</option>
          </select>
        </div>
      </section>
    </section>
  )
}
