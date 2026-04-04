export type SpecCompareOptionsPanelProps = {
  outputFormat: string
  onOutputFormatChange: (value: string) => void
  textStyle: string
  onTextStyleChange: (value: string) => void
  failOn: string
  onFailOnChange: (value: string) => void
  ignorePathsDraft: string
  onIgnorePathsDraftChange: (value: string) => void
  onIgnorePathsCommit: (value: string) => void
  showPaths: boolean
  onShowPathsChange: (checked: boolean) => void
  onlyBreaking: boolean
  onOnlyBreakingChange: (checked: boolean) => void
}

export function SpecCompareOptionsPanel({
  outputFormat,
  onOutputFormatChange,
  textStyle,
  onTextStyleChange,
  failOn,
  onFailOnChange,
  ignorePathsDraft,
  onIgnorePathsDraftChange,
  onIgnorePathsCommit,
  showPaths,
  onShowPathsChange,
  onlyBreaking,
  onOnlyBreakingChange,
}: SpecCompareOptionsPanelProps) {
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

        <div className="field-block">
          <label className="field-label">Text style</label>
          <select
            value={textStyle}
            disabled={outputFormat === 'json'}
            onChange={(e) => onTextStyleChange(e.target.value)}
          >
            <option value="auto">auto</option>
            <option value="semantic">semantic</option>
          </select>
        </div>
      </section>

      <details className="advanced-panel" open>
        <summary className="advanced-summary">Advanced options</summary>

        <div className="field-block">
          <label className="field-label">Fail on</label>
          <select value={failOn} onChange={(e) => onFailOnChange(e.target.value)}>
            <option value="none">none</option>
            <option value="breaking">breaking</option>
            <option value="any">any</option>
          </select>
        </div>

        <div className="field-block">
          <label className="field-label">Ignore paths</label>
          <textarea
            className="ignore-paths-input"
            value={ignorePathsDraft}
            onChange={(e) => onIgnorePathsDraftChange(e.target.value)}
            onBlur={(e) => onIgnorePathsCommit(e.target.value)}
            placeholder={'paths./users.post.requestBody.required'}
          />
          <div className="helper-text">
            Enter one canonical path per line (exact match), e.g.{' '}
            <code>paths./users.post.requestBody.required</code>.
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

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={onlyBreaking}
            onChange={(e) => onOnlyBreakingChange(e.target.checked)}
          />
          only breaking
        </label>
      </details>
    </section>
  )
}
