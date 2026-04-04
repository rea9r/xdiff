import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconFileSearch,
  IconFolderOpen,
  IconPlayerPlay,
} from '@tabler/icons-react'
import type { ScenarioControlPanelProps } from './ScenarioControlPanel'
import { ComparePaneAction, ComparePaneActions } from '../../ui/CompareSourceActions'
import { CompareSourcePane } from '../../ui/CompareSourcePane'
import { CompareSearchControls } from '../../ui/CompareSearchControls'
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
  const [checkSearchQuery, setCheckSearchQuery] = useState('')
  const [activeCheckSearchIndex, setActiveCheckSearchIndex] = useState(0)
  const checkInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const normalizedCheckSearchQuery = checkSearchQuery.trim().toLowerCase()
  const filteredScenarioChecks = useMemo(
    () =>
      scenarioChecks.filter((check) => {
        if (!normalizedCheckSearchQuery) return true
        return [check.name, check.kind, check.summary].some((value) =>
          value.toLowerCase().includes(normalizedCheckSearchQuery),
        )
      }),
    [normalizedCheckSearchQuery, scenarioChecks],
  )

  useEffect(() => {
    setActiveCheckSearchIndex(0)
  }, [normalizedCheckSearchQuery, scenarioChecks])

  useEffect(() => {
    if (!normalizedCheckSearchQuery || filteredScenarioChecks.length === 0) {
      return
    }
    const active = filteredScenarioChecks[activeCheckSearchIndex]
    if (!active) {
      return
    }
    checkInputRefs.current[active.name]?.focus()
  }, [activeCheckSearchIndex, filteredScenarioChecks, normalizedCheckSearchQuery])

  const moveCheckSearch = (direction: 1 | -1) => {
    if (!normalizedCheckSearchQuery || filteredScenarioChecks.length === 0) {
      return
    }
    setActiveCheckSearchIndex((current) => {
      const next = current + direction
      if (next < 0) {
        return filteredScenarioChecks.length - 1
      }
      if (next >= filteredScenarioChecks.length) {
        return 0
      }
      return next
    })
  }

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

        <div className="field-block">
          <label className="field-label">Search checks</label>
          <div className="compare-search-controls scenario-check-search-controls">
            <CompareSearchControls
              value={checkSearchQuery}
              placeholder="Search checks"
              statusText={
                normalizedCheckSearchQuery
                  ? filteredScenarioChecks.length > 0
                    ? `${activeCheckSearchIndex + 1} / ${filteredScenarioChecks.length}`
                    : '0 matches'
                  : `${selectedChecks.length} selected / ${scenarioChecks.length}`
              }
              onChange={setCheckSearchQuery}
              onPrev={() => moveCheckSearch(-1)}
              onNext={() => moveCheckSearch(1)}
              prevDisabled={!normalizedCheckSearchQuery || filteredScenarioChecks.length === 0}
              nextDisabled={!normalizedCheckSearchQuery || filteredScenarioChecks.length === 0}
            />
          </div>
        </div>

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
          ) : filteredScenarioChecks.length === 0 ? (
            <div className="muted">No checks match current search.</div>
          ) : (
            filteredScenarioChecks.map((check, index) => (
              <label key={check.name} className="scenario-check-item">
                <input
                  type="checkbox"
                  checked={selectedChecks.includes(check.name)}
                  onChange={(event) => onToggleCheck(check.name, event.target.checked)}
                  ref={(node) => {
                    checkInputRefs.current[check.name] = node
                  }}
                />
                <div
                  className={
                    normalizedCheckSearchQuery && index === activeCheckSearchIndex
                      ? 'scenario-check-match-active'
                      : undefined
                  }
                >
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
