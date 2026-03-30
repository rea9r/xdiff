import { Menu } from '@mantine/core'
import type { DesktopRecentScenarioPath, ScenarioCheckListEntry } from '../../types'

type ScenarioControlPanelProps = {
  scenarioPath: string
  onScenarioPathChange: (value: string) => void
  onBrowseScenario: () => void
  scenarioRecentPaths: DesktopRecentScenarioPath[]
  onLoadRecentScenario: (entry: DesktopRecentScenarioPath) => void
  onClearRecentScenarios: () => void
  reportFormat: 'text' | 'json'
  onReportFormatChange: (value: 'text' | 'json') => void
  loading: boolean
  onLoadChecks: () => void
  onRun: () => void
  scenarioListStatus: string
  scenarioChecks: ScenarioCheckListEntry[]
  selectedChecks: string[]
  onToggleCheck: (name: string, checked: boolean) => void
  onSelectAllChecks: () => void
  onClearCheckSelection: () => void
}

export function ScenarioControlPanel({
  scenarioPath,
  onScenarioPathChange,
  onBrowseScenario,
  scenarioRecentPaths,
  onLoadRecentScenario,
  onClearRecentScenarios,
  reportFormat,
  onReportFormatChange,
  loading,
  onLoadChecks,
  onRun,
  scenarioListStatus,
  scenarioChecks,
  selectedChecks,
  onToggleCheck,
  onSelectAllChecks,
  onClearCheckSelection,
}: ScenarioControlPanelProps) {
  return (
    <section className="mode-panel">
      <div className="field-block">
        <label className="field-label">Scenario path</label>
        <div className="path-row">
          <input value={scenarioPath} onChange={(e) => onScenarioPathChange(e.target.value)} />
          <button type="button" className="button-secondary" onClick={onBrowseScenario}>
            Browse...
          </button>
        </div>
        <div className="button-row">
          <Menu position="bottom-start" withinPortal>
            <Menu.Target>
              <button
                type="button"
                className="button-secondary button-compact"
                disabled={scenarioRecentPaths.length === 0}
              >
                Recent scenarios
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              {scenarioRecentPaths.map((entry) => (
                <Menu.Item
                  key={`${entry.path}::${entry.reportFormat}`}
                  onClick={() => onLoadRecentScenario(entry)}
                >
                  {entry.path} ({entry.reportFormat})
                </Menu.Item>
              ))}
              <Menu.Divider />
              <Menu.Item color="red" onClick={onClearRecentScenarios}>
                Clear recent
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      <div className="field-block">
        <label className="field-label">Report format</label>
        <select value={reportFormat} onChange={(e) => onReportFormatChange(e.target.value as 'text' | 'json')}>
          <option value="text">text</option>
          <option value="json">json</option>
        </select>
      </div>

      <div className="button-row">
        <button className="button-secondary" onClick={onLoadChecks} disabled={loading}>
          {loading ? 'Loading...' : 'Load checks'}
        </button>
        <button className="button-primary" onClick={onRun} disabled={loading}>
          {loading ? 'Running...' : 'Run selected'}
        </button>
      </div>

      {scenarioListStatus ? <div className="muted">{scenarioListStatus}</div> : null}

      <div className="button-row">
        <button
          className="button-secondary button-compact"
          onClick={onSelectAllChecks}
          disabled={scenarioChecks.length === 0}
        >
          Select all
        </button>
        <button
          className="button-secondary button-compact"
          onClick={onClearCheckSelection}
          disabled={selectedChecks.length === 0}
        >
          Clear
        </button>
      </div>

      <div className="scenario-check-list">
        {scenarioChecks.length === 0 ? (
          <div className="muted">No checks loaded yet.</div>
        ) : (
          scenarioChecks.map((check) => (
            <label key={check.name} className="scenario-check-item">
              <input
                type="checkbox"
                checked={selectedChecks.includes(check.name)}
                onChange={(e) => onToggleCheck(check.name, e.target.checked)}
              />
              <div>
                <div className="scenario-check-title">
                  {check.name} <span className="muted">({check.kind})</span>
                </div>
                <div className="scenario-check-summary">{check.summary}</div>
              </div>
            </label>
          ))
        )}
      </div>
    </section>
  )
}
