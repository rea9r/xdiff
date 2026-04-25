export type TextCompareOptionsPanelProps = {
  outputFormat: string
  onOutputFormatChange: (value: string) => void
}

export function TextCompareOptionsPanel({
  outputFormat,
  onOutputFormatChange,
}: TextCompareOptionsPanelProps) {
  return (
    <section className="mode-panel">
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
