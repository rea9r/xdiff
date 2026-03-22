import { useMemo, useState } from 'react'
import type {
  CompareCommon,
  CompareResponse,
  Mode,
  ScenarioCheckListEntry,
  ScenarioListResponse,
  ScenarioRunResponse,
} from './types'
import './style.css'

const defaultCommon: CompareCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

function renderResult(res: unknown): string {
  if (typeof res === 'string') return res
  if (!res) return '(no response)'

  const maybe = res as {
    error?: string
    output?: string
  }

  if (maybe.error) return String(maybe.error)
  if (maybe.output) return String(maybe.output)

  return JSON.stringify(res, null, 2)
}

function summarizeResponse(res: unknown): string {
  if (!res || typeof res !== 'object') return ''

  const r = res as {
    exitCode?: number
    diffFound?: boolean
    error?: string
    summary?: { total: number; ok: number; diff: number; error: number; exitCode: number }
  }

  if (r.summary) {
    return `exit=${r.summary.exitCode} total=${r.summary.total} ok=${r.summary.ok} diff=${r.summary.diff} error=${r.summary.error}`
  }

  const parts: string[] = []
  if (typeof r.exitCode === 'number') parts.push(`exit=${r.exitCode}`)
  if (typeof r.diffFound === 'boolean') parts.push(`diff=${r.diffFound ? 'yes' : 'no'}`)
  if (r.error) parts.push('error=yes')

  return parts.join(' ')
}

export function App() {
  const [mode, setMode] = useState<Mode>('json')

  const [jsonOldPath, setJSONOldPath] = useState('')
  const [jsonNewPath, setJSONNewPath] = useState('')
  const [ignoreOrder, setIgnoreOrder] = useState(false)

  const [specOldPath, setSpecOldPath] = useState('')
  const [specNewPath, setSpecNewPath] = useState('')

  const [scenarioPath, setScenarioPath] = useState('')
  const [reportFormat, setReportFormat] = useState<'text' | 'json'>('text')
  const [scenarioChecks, setScenarioChecks] = useState<ScenarioCheckListEntry[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])

  const [summaryLine, setSummaryLine] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const api = useMemo(
    () => ({
      compareJSON: (window as any).go?.main?.App?.CompareJSONFiles,
      compareSpec: (window as any).go?.main?.App?.CompareSpecFiles,
      runScenario: (window as any).go?.main?.App?.RunScenario,
      listScenarioChecks: (window as any).go?.main?.App?.ListScenarioChecks,
      pickJSONFile: (window as any).go?.main?.App?.PickJSONFile,
      pickSpecFile: (window as any).go?.main?.App?.PickSpecFile,
      pickScenarioFile: (window as any).go?.main?.App?.PickScenarioFile,
    }),
    [],
  )

  const setResult = (res: unknown) => {
    setSummaryLine(summarizeResponse(res))
    setOutput(renderResult(res))
  }

  const browseAndSet = async (
    picker: (() => Promise<string>) | undefined,
    setter: (value: string) => void,
  ) => {
    if (!picker) {
      setSummaryLine('error=yes')
      setOutput('Wails bridge not available (file picker)')
      return
    }

    try {
      const selected = await picker()
      if (selected) {
        setter(selected)
      }
    } catch (e) {
      setSummaryLine('error=yes')
      setOutput(String(e))
    }
  }

  const runJSON = async () => {
    const fn = api.compareJSON
    if (!fn) throw new Error('Wails bridge not available (CompareJSONFiles)')

    const res: CompareResponse = await fn({
      oldPath: jsonOldPath,
      newPath: jsonNewPath,
      common: defaultCommon,
      ignoreOrder,
    })
    setResult(res)
  }

  const runSpec = async () => {
    const fn = api.compareSpec
    if (!fn) throw new Error('Wails bridge not available (CompareSpecFiles)')

    const res: CompareResponse = await fn({
      oldPath: specOldPath,
      newPath: specNewPath,
      common: defaultCommon,
    })
    setResult(res)
  }

  const loadScenarioChecks = async () => {
    const fn = api.listScenarioChecks
    if (!fn) throw new Error('Wails bridge not available (ListScenarioChecks)')

    const res: ScenarioListResponse = await fn({
      scenarioPath,
      reportFormat,
      only: [],
    })

    setResult(res)
    setScenarioChecks(res.checks ?? [])
    setSelectedChecks([])
  }

  const runScenario = async () => {
    const fn = api.runScenario
    if (!fn) throw new Error('Wails bridge not available (RunScenario)')

    const res: ScenarioRunResponse = await fn({
      scenarioPath,
      reportFormat,
      only: selectedChecks,
    })
    setResult(res)
  }

  const runByMode = async () => {
    if (mode === 'json') {
      await runJSON()
      return
    }
    if (mode === 'spec') {
      await runSpec()
      return
    }
    await runScenario()
  }

  const onRun = async () => {
    setLoading(true)
    setSummaryLine('')
    setOutput('')

    try {
      await runByMode()
    } catch (e) {
      setSummaryLine('error=yes')
      setOutput(String(e))
    } finally {
      setLoading(false)
    }
  }

  const onLoadScenarioChecks = async () => {
    setLoading(true)
    setSummaryLine('')
    setOutput('')

    try {
      await loadScenarioChecks()
    } catch (e) {
      setSummaryLine('error=yes')
      setOutput(String(e))
    } finally {
      setLoading(false)
    }
  }

  const toggleScenarioCheck = (name: string, checked: boolean) => {
    setSelectedChecks((prev) => {
      if (checked) {
        if (prev.includes(name)) return prev
        return [...prev, name]
      }
      return prev.filter((v) => v !== name)
    })
  }

  const selectAllScenarioChecks = () => {
    setSelectedChecks(scenarioChecks.map((c) => c.name))
  }

  const clearScenarioSelection = () => {
    setSelectedChecks([])
  }

  return (
    <div className="app-shell">
      <aside className="control-panel">
        <h1>xdiff Desktop</h1>

        <div className="field-block">
          <label className="field-label">Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="json">JSON compare</option>
            <option value="spec">OpenAPI spec compare</option>
            <option value="scenario">Scenario run</option>
          </select>
        </div>

        {mode === 'json' && (
          <section className="mode-panel">
            <div className="field-block">
              <label className="field-label">Old path</label>
              <div className="path-row">
                <input value={jsonOldPath} onChange={(e) => setJSONOldPath(e.target.value)} />
                <button type="button" onClick={() => browseAndSet(api.pickJSONFile, setJSONOldPath)}>
                  Browse...
                </button>
              </div>
            </div>

            <div className="field-block">
              <label className="field-label">New path</label>
              <div className="path-row">
                <input value={jsonNewPath} onChange={(e) => setJSONNewPath(e.target.value)} />
                <button type="button" onClick={() => browseAndSet(api.pickJSONFile, setJSONNewPath)}>
                  Browse...
                </button>
              </div>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={ignoreOrder}
                onChange={(e) => setIgnoreOrder(e.target.checked)}
              />
              ignore array order
            </label>

            <button onClick={onRun} disabled={loading}>
              {loading ? 'Running...' : 'Run JSON compare'}
            </button>
          </section>
        )}

        {mode === 'spec' && (
          <section className="mode-panel">
            <div className="field-block">
              <label className="field-label">Old spec path</label>
              <div className="path-row">
                <input value={specOldPath} onChange={(e) => setSpecOldPath(e.target.value)} />
                <button type="button" onClick={() => browseAndSet(api.pickSpecFile, setSpecOldPath)}>
                  Browse...
                </button>
              </div>
            </div>

            <div className="field-block">
              <label className="field-label">New spec path</label>
              <div className="path-row">
                <input value={specNewPath} onChange={(e) => setSpecNewPath(e.target.value)} />
                <button type="button" onClick={() => browseAndSet(api.pickSpecFile, setSpecNewPath)}>
                  Browse...
                </button>
              </div>
            </div>

            <button onClick={onRun} disabled={loading}>
              {loading ? 'Running...' : 'Run spec compare'}
            </button>
          </section>
        )}

        {mode === 'scenario' && (
          <section className="mode-panel">
            <div className="field-block">
              <label className="field-label">Scenario path</label>
              <div className="path-row">
                <input value={scenarioPath} onChange={(e) => setScenarioPath(e.target.value)} />
                <button type="button" onClick={() => browseAndSet(api.pickScenarioFile, setScenarioPath)}>
                  Browse...
                </button>
              </div>
            </div>

            <div className="field-block">
              <label className="field-label">Report format</label>
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value as 'text' | 'json')}
              >
                <option value="text">text</option>
                <option value="json">json</option>
              </select>
            </div>

            <div className="button-row">
              <button onClick={onLoadScenarioChecks} disabled={loading}>
                {loading ? 'Loading...' : 'Load checks'}
              </button>
              <button onClick={onRun} disabled={loading}>
                {loading ? 'Running...' : 'Run selected'}
              </button>
            </div>

            <div className="button-row">
              <button onClick={selectAllScenarioChecks} disabled={scenarioChecks.length === 0}>
                Select all
              </button>
              <button onClick={clearScenarioSelection} disabled={selectedChecks.length === 0}>
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
                      onChange={(e) => toggleScenarioCheck(check.name, e.target.checked)}
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
        )}
      </aside>

      <main className="result-panel">
        <h2>Result</h2>
        {summaryLine ? <div className="result-summary">{summaryLine}</div> : null}
        <pre className="result-output">{output || '(no output yet)'}</pre>
      </main>
    </div>
  )
}
