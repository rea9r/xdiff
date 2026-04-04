import type { ScenarioResult, ScenarioRunResponse } from '../../types'
import { StatusBadge } from '../../ui/StatusBadge'

export type ScenarioResultPanelProps = {
  scenarioRunResult: ScenarioRunResponse | null
  selectedScenarioResultName: string
  setSelectedScenarioResultName: (value: string) => void
}

function classForStatus(status: string): string {
  if (status === 'ok' || status === 'diff' || status === 'error') return status
  return 'error'
}

function toneForScenarioStatus(status: string): 'success' | 'warning' | 'danger' {
  if (status === 'ok') return 'success'
  if (status === 'diff') return 'warning'
  return 'danger'
}

function getSelectedScenarioResult(
  scenarioRunResult: ScenarioRunResponse | null,
  selectedScenarioResultName: string,
): ScenarioResult | null {
  if (!scenarioRunResult?.results || !selectedScenarioResultName) return null
  return scenarioRunResult.results.find((r) => r.name === selectedScenarioResultName) ?? null
}

export function ScenarioResultPanel({
  scenarioRunResult,
  selectedScenarioResultName,
  setSelectedScenarioResultName,
}: ScenarioResultPanelProps) {
  if (!scenarioRunResult) {
    return <div className="muted">(no scenario run yet)</div>
  }

  if (scenarioRunResult.error) {
    return (
      <div className="scenario-result-detail">
        <StatusBadge tone="danger">error</StatusBadge>
        <pre>{scenarioRunResult.error}</pre>
      </div>
    )
  }

  const summary = scenarioRunResult.summary
  const results = scenarioRunResult.results ?? []
  const selected =
    getSelectedScenarioResult(scenarioRunResult, selectedScenarioResultName) ??
    results.find((r) => r.status !== 'ok') ??
    results[0] ??
    null

  return (
    <div className="scenario-result-shell">
      {summary ? (
        <div className="scenario-summary-grid">
          <div>
            <strong>exit</strong> {summary.exitCode}
          </div>
          <div>
            <strong>total</strong> {summary.total}
          </div>
          <div>
            <strong>ok</strong> {summary.ok}
          </div>
          <div>
            <strong>diff</strong> {summary.diff}
          </div>
          <div>
            <strong>error</strong> {summary.error}
          </div>
        </div>
      ) : null}

      <div className="scenario-results-layout">
        <div className="scenario-results-list">
          {results.map((r) => (
            <button
              key={r.name}
              className={`scenario-result-item ${selected?.name === r.name ? 'active' : ''}`}
              onClick={() => setSelectedScenarioResultName(r.name)}
              type="button"
            >
              <div className="scenario-result-item-top">
                <span>{r.name}</span>
                <StatusBadge tone={toneForScenarioStatus(classForStatus(r.status))}>
                  {r.status}
                </StatusBadge>
              </div>
              <div className="scenario-result-item-sub">
                <span>{r.kind}</span>
                <span>exit={r.exitCode}</span>
                <span>diff={r.diffFound ? 'yes' : 'no'}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="scenario-result-detail">
          {selected ? (
            <>
              <h3>{selected.name}</h3>
              <div className="muted">
                {selected.kind} · status={selected.status} · exit={selected.exitCode} · diff={selected.diffFound ? 'yes' : 'no'}
              </div>
              {selected.errorMessage ? <pre>{selected.errorMessage}</pre> : null}
              {selected.output ? <pre>{selected.output}</pre> : null}
              {!selected.errorMessage && !selected.output ? (
                <div className="muted">(no detail)</div>
              ) : null}
            </>
          ) : (
            <div className="muted">(no selected result)</div>
          )}
        </div>
      </div>
    </div>
  )
}
