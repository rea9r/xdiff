import {
  IconFileSearch,
  IconFolderOpen,
  IconPlayerPlay,
} from '@tabler/icons-react'
import type { ScenarioControlPanelProps } from './ScenarioControlPanel'
import { ComparePaneAction, ComparePaneActions } from '../../ui/CompareSourceActions'
import { CompareSourcePane } from '../../ui/CompareSourcePane'
import { RecentTargetsMenu } from '../../ui/RecentTargetsMenu'

export type ScenarioSourceWorkspaceProps = ScenarioControlPanelProps

export function ScenarioSourceWorkspace({
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
}: ScenarioSourceWorkspaceProps) {
  return (
    <CompareSourcePane
      title="Scenario source"
      sourcePath={scenarioPath}
      actions={
        <ComparePaneActions>
          <ComparePaneAction
            label="Browse scenario file"
            onClick={onBrowseScenario}
            disabled={loading}
          >
            <IconFolderOpen size={14} />
          </ComparePaneAction>
          <RecentTargetsMenu
            buttonLabel="Recent scenarios"
            disabled={scenarioRecentPaths.length === 0}
            items={scenarioRecentPaths.map((entry) => ({
              key: `${entry.path}::${entry.reportFormat}`,
              label: `${entry.path} (${entry.reportFormat})`,
              onClick: () => onLoadRecentScenario(entry),
            }))}
            clearLabel="Clear recent scenarios"
            onClear={onClearRecentScenarios}
          />
          <ComparePaneAction
            label="Load checks"
            onClick={onLoadChecks}
            disabled={loading}
            loading={loading}
          >
            <IconFileSearch size={14} />
          </ComparePaneAction>
          <ComparePaneAction
            label="Run selected checks"
            onClick={onRun}
            disabled={loading}
            loading={loading}
          >
            <IconPlayerPlay size={14} />
          </ComparePaneAction>
        </ComparePaneActions>
      }
    >
      <section className="scenario-source-workspace">
        <div className="field-block">
          <label className="field-label">Scenario path</label>
          <input
            value={scenarioPath}
            onChange={(event) => onScenarioPathChange(event.target.value)}
            placeholder="Select scenario file"
          />
        </div>

        <div className="field-block">
          <label className="field-label">Report format</label>
          <select
            value={reportFormat}
            onChange={(event) => onReportFormatChange(event.target.value as 'text' | 'json')}
          >
            <option value="text">text</option>
            <option value="json">json</option>
          </select>
        </div>

        {scenarioListStatus ? <div className="muted">{scenarioListStatus}</div> : null}

        <div className="button-row">
          <button
            className="button-secondary button-compact"
            onClick={onSelectAllChecks}
            disabled={scenarioChecks.length === 0}
            type="button"
          >
            Select all
          </button>
          <button
            className="button-secondary button-compact"
            onClick={onClearCheckSelection}
            disabled={selectedChecks.length === 0}
            type="button"
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
                  onChange={(event) => onToggleCheck(check.name, event.target.checked)}
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
    </CompareSourcePane>
  )
}
