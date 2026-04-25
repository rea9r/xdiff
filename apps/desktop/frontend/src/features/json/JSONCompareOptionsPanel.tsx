export type JSONCompareOptionsPanelProps = {
  ignoreOrder: boolean
  onIgnoreOrderChange: (checked: boolean) => void
  outputFormat: string
  onOutputFormatChange: (value: string) => void
  textStyle: string
  onTextStyleChange: (value: string) => void
  patchTextStyleDisabled: boolean
  ignorePathsDraft: string
  onIgnorePathsDraftChange: (value: string) => void
  onIgnorePathsCommit: (value: string) => void
  showPaths: boolean
  onShowPathsChange: (checked: boolean) => void
}

export function JSONCompareOptionsPanel({
  ignoreOrder,
  onIgnoreOrderChange,
  outputFormat,
  onOutputFormatChange,
  textStyle,
  onTextStyleChange,
  patchTextStyleDisabled,
  ignorePathsDraft,
  onIgnorePathsDraftChange,
  onIgnorePathsCommit,
  showPaths,
  onShowPathsChange,
}: JSONCompareOptionsPanelProps) {
  return (
    <section className="mode-panel">
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={ignoreOrder}
          onChange={(e) => onIgnoreOrderChange(e.target.checked)}
        />
        ignore array order
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

        <div className="field-block">
          <label className="field-label">Text style</label>
          <select
            value={textStyle}
            disabled={outputFormat === 'json'}
            onChange={(e) => onTextStyleChange(e.target.value)}
          >
            <option value="auto">auto</option>
            <option value="patch" disabled={patchTextStyleDisabled}>
              patch
            </option>
            <option value="semantic">semantic</option>
          </select>
        </div>
      </section>

      <details className="advanced-panel" open>
        <summary className="advanced-summary">Advanced options</summary>

        <div className="field-block">
          <label className="field-label">Ignore paths</label>
          <textarea
            className="ignore-paths-input"
            value={ignorePathsDraft}
            onChange={(e) => onIgnorePathsDraftChange(e.target.value)}
            onBlur={(e) => onIgnorePathsCommit(e.target.value)}
            placeholder={'user.updated_at\nmeta.request_id'}
          />
          <div className="helper-text">
            Enter one canonical path per line (exact match), e.g. <code>user.updated_at</code>.
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showPaths}
            onChange={(e) => onShowPathsChange(e.target.checked)}
          />
          show canonical paths
        </label>
      </details>
    </section>
  )
}
