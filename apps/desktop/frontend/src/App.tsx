import { useEffect, useMemo, useState } from 'react'
import type {
  CompareCommon,
  CompareResponse,
  Mode,
  ScenarioCheckListEntry,
  ScenarioListResponse,
  ScenarioResult,
  ScenarioRunResponse,
} from './types'
import './style.css'

const defaultJSONCommon: CompareCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

const defaultSpecCommon: CompareCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'semantic',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

const defaultTextCommon: CompareCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

type TextResultView = 'rich' | 'raw'

type UnifiedDiffRowKind = 'meta' | 'hunk' | 'context' | 'add' | 'remove'

type UnifiedDiffRow = {
  kind: UnifiedDiffRowKind
  oldLine: number | null
  newLine: number | null
  content: string
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

function chooseInitialScenarioResult(res: ScenarioRunResponse): string {
  const results = res.results ?? []
  if (results.length === 0) return ''

  const firstNonOK = results.find((r) => r.status !== 'ok')
  if (firstNonOK) return firstNonOK.name

  return results[0].name
}

function classForStatus(status: string): string {
  if (status === 'ok' || status === 'diff' || status === 'error') return status
  return 'error'
}

function ignorePathsToText(paths: string[]): string {
  return paths.join('\n')
}

function parseIgnorePaths(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function parseUnifiedDiff(output: string): UnifiedDiffRow[] | null {
  const lines = output.split('\n')
  const rows: UnifiedDiffRow[] = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === lines.length - 1 && line === '') {
      continue
    }

    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      rows.push({ kind: 'meta', oldLine: null, newLine: null, content: line })
      continue
    }

    if (line.startsWith('@@ ')) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (!match) {
        return null
      }
      oldLine = Number(match[1])
      newLine = Number(match[2])
      inHunk = true
      rows.push({ kind: 'hunk', oldLine: null, newLine: null, content: line })
      continue
    }

    if (!inHunk) {
      rows.push({ kind: 'meta', oldLine: null, newLine: null, content: line })
      continue
    }

    if (line.startsWith('+')) {
      rows.push({
        kind: 'add',
        oldLine: null,
        newLine,
        content: line.slice(1),
      })
      newLine++
      continue
    }

    if (line.startsWith('-')) {
      rows.push({
        kind: 'remove',
        oldLine,
        newLine: null,
        content: line.slice(1),
      })
      oldLine++
      continue
    }

    if (line.startsWith(' ')) {
      rows.push({
        kind: 'context',
        oldLine,
        newLine,
        content: line.slice(1),
      })
      oldLine++
      newLine++
      continue
    }

    rows.push({ kind: 'meta', oldLine: null, newLine: null, content: line })
  }

  return rows
}

export function App() {
  const [mode, setMode] = useState<Mode>('json')

  const [jsonOldPath, setJSONOldPath] = useState('')
  const [jsonNewPath, setJSONNewPath] = useState('')
  const [ignoreOrder, setIgnoreOrder] = useState(false)
  const [jsonCommon, setJSONCommon] = useState<CompareCommon>(defaultJSONCommon)
  const [jsonIgnorePathsDraft, setJSONIgnorePathsDraft] = useState(() =>
    ignorePathsToText(defaultJSONCommon.ignorePaths),
  )

  const [specOldPath, setSpecOldPath] = useState('')
  const [specNewPath, setSpecNewPath] = useState('')
  const [specCommon, setSpecCommon] = useState<CompareCommon>(defaultSpecCommon)
  const [specIgnorePathsDraft, setSpecIgnorePathsDraft] = useState(() =>
    ignorePathsToText(defaultSpecCommon.ignorePaths),
  )

  const [textOld, setTextOld] = useState('')
  const [textNew, setTextNew] = useState('')
  const [textCommon, setTextCommon] = useState<CompareCommon>(defaultTextCommon)
  const [textResultView, setTextResultView] = useState<TextResultView>('rich')
  const [textResult, setTextResult] = useState<CompareResponse | null>(null)

  const [scenarioPath, setScenarioPath] = useState('')
  const [reportFormat, setReportFormat] = useState<'text' | 'json'>('text')
  const [scenarioChecks, setScenarioChecks] = useState<ScenarioCheckListEntry[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])
  const [scenarioListStatus, setScenarioListStatus] = useState('')
  const [scenarioRunResult, setScenarioRunResult] = useState<ScenarioRunResponse | null>(null)
  const [selectedScenarioResultName, setSelectedScenarioResultName] = useState('')

  const [summaryLine, setSummaryLine] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const effectiveJSONIgnorePaths = parseIgnorePaths(jsonIgnorePathsDraft)
  const effectiveSpecIgnorePaths = parseIgnorePaths(specIgnorePathsDraft)

  const jsonPatchBlockedByFilters =
    ignoreOrder || jsonCommon.onlyBreaking || effectiveJSONIgnorePaths.length > 0

  useEffect(() => {
    if (jsonCommon.textStyle !== 'patch') {
      return
    }
    if (!jsonPatchBlockedByFilters) {
      return
    }
    setJSONCommon((prev) => ({ ...prev, textStyle: 'semantic' }))
  }, [jsonCommon.textStyle, jsonPatchBlockedByFilters])

  const api = useMemo(
    () => ({
      compareJSON: (window as any).go?.main?.App?.CompareJSONFiles,
      compareSpec: (window as any).go?.main?.App?.CompareSpecFiles,
      compareText: (window as any).go?.main?.App?.CompareText,
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

  const updateJSONCommon = <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
    setJSONCommon((prev) => ({ ...prev, [key]: value }))
  }

  const updateSpecCommon = <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
    setSpecCommon((prev) => ({ ...prev, [key]: value }))
  }

  const updateTextCommon = <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
    setTextCommon((prev) => ({ ...prev, [key]: value }))
  }

  const setScenarioRunResultView = (res: ScenarioRunResponse) => {
    setScenarioRunResult(res)
    setSelectedScenarioResultName(chooseInitialScenarioResult(res))
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

    const safeJSONCommon = {
      ...jsonCommon,
      ignorePaths: effectiveJSONIgnorePaths,
      textStyle:
        jsonCommon.textStyle === 'patch' && jsonPatchBlockedByFilters
          ? 'semantic'
          : jsonCommon.textStyle,
    }

    const res: CompareResponse = await fn({
      oldPath: jsonOldPath,
      newPath: jsonNewPath,
      common: safeJSONCommon,
      ignoreOrder,
    })
    setResult(res)
  }

  const runSpec = async () => {
    const fn = api.compareSpec
    if (!fn) throw new Error('Wails bridge not available (CompareSpecFiles)')

    const safeSpecCommon = {
      ...specCommon,
      ignorePaths: effectiveSpecIgnorePaths,
      textStyle: specCommon.textStyle === 'patch' ? 'semantic' : specCommon.textStyle,
    }

    const res: CompareResponse = await fn({
      oldPath: specOldPath,
      newPath: specNewPath,
      common: safeSpecCommon,
    })
    setResult(res)
  }

  const runText = async () => {
    const fn = api.compareText
    if (!fn) throw new Error('Wails bridge not available (CompareText)')

    const res: CompareResponse = await fn({
      oldText: textOld,
      newText: textNew,
      common: textCommon,
    })
    setTextResult(res)
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

    if (res.error) {
      setScenarioChecks([])
      setSelectedChecks([])
      setScenarioListStatus(res.error)
      return
    }

    setScenarioChecks(res.checks ?? [])
    setSelectedChecks([])
    setScenarioListStatus(`loaded ${res.checks?.length ?? 0} checks`)
  }

  const runScenario = async () => {
    const fn = api.runScenario
    if (!fn) throw new Error('Wails bridge not available (RunScenario)')

    const res: ScenarioRunResponse = await fn({
      scenarioPath,
      reportFormat,
      only: selectedChecks,
    })

    setScenarioRunResultView(res)
    setSummaryLine('')
    setOutput('')
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
    if (mode === 'text') {
      await runText()
      return
    }
    await runScenario()
  }

  const onRun = async () => {
    setLoading(true)

    if (mode !== 'scenario') {
      setSummaryLine('')
      setOutput('')
    }
    if (mode === 'text') {
      setTextResult(null)
    }

    try {
      await runByMode()
    } catch (e) {
      if (mode === 'scenario') {
        const errorText = String(e)
        setScenarioRunResult({
          exitCode: 2,
          error: errorText,
        })
        setSelectedScenarioResultName('')
      } else {
        setSummaryLine('error=yes')
        setOutput(String(e))
      }
    } finally {
      setLoading(false)
    }
  }

  const onLoadScenarioChecks = async () => {
    setLoading(true)

    try {
      await loadScenarioChecks()
    } catch (e) {
      setScenarioChecks([])
      setSelectedChecks([])
      setScenarioListStatus(String(e))
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

  const getSelectedScenarioResult = (): ScenarioResult | null => {
    if (!scenarioRunResult?.results || !selectedScenarioResultName) return null
    return scenarioRunResult.results.find((r) => r.name === selectedScenarioResultName) ?? null
  }

  const renderScenarioResultPanel = () => {
    if (!scenarioRunResult) {
      return <div className="muted">(no scenario run yet)</div>
    }

    if (scenarioRunResult.error) {
      return (
        <div className="scenario-result-detail">
          <div className="status-badge error">error</div>
          <pre>{scenarioRunResult.error}</pre>
        </div>
      )
    }

    const summary = scenarioRunResult.summary
    const results = scenarioRunResult.results ?? []
    const selected =
      getSelectedScenarioResult() ??
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
                  <span className={`status-badge ${classForStatus(r.status)}`}>{r.status}</span>
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

  const renderTextDiffRows = (rows: UnifiedDiffRow[]) => {
    return (
      <div className="text-diff-grid">
        {rows.map((row, idx) => (
          <div key={`${idx}-${row.kind}`} className={`text-diff-row ${row.kind}`}>
            <div className="text-diff-line">{row.oldLine ?? ''}</div>
            <div className="text-diff-line">{row.newLine ?? ''}</div>
            <pre className="text-diff-content">{row.content}</pre>
          </div>
        ))}
      </div>
    )
  }

  const renderTextResultPanel = () => {
    const raw = textResult ? renderResult(textResult) : ''
    const parsed = textResult?.output ? parseUnifiedDiff(textResult.output) : null
    const showRich =
      textResultView === 'rich' &&
      textCommon.outputFormat === 'text' &&
      textResult &&
      !textResult.error &&
      parsed

    return (
      <div className="text-result-shell">
        <div className="result-summary">{summaryLine || '(no result yet)'}</div>

        <div className="text-result-tabs">
          <button
            type="button"
            className={textResultView === 'rich' ? 'active' : ''}
            onClick={() => setTextResultView('rich')}
            disabled={textCommon.outputFormat === 'json'}
          >
            Rich diff
          </button>
          <button
            type="button"
            className={textResultView === 'raw' ? 'active' : ''}
            onClick={() => setTextResultView('raw')}
          >
            Raw output
          </button>
        </div>

        <div className="text-result-body">
          {showRich ? (
            renderTextDiffRows(parsed)
          ) : (
            <pre className="result-output">{raw || '(no output yet)'}</pre>
          )}
        </div>
      </div>
    )
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
            <option value="text">Text compare</option>
            <option value="scenario">Scenario run</option>
          </select>
        </div>

        {mode === 'json' && (
          <section className="mode-panel">
            <div className="field-block">
              <h3 className="section-title">Paths</h3>
            </div>

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

            <section className="options-panel">
              <h3>Options</h3>

              <div className="field-block">
                <label className="field-label">Output format</label>
                <select
                  value={jsonCommon.outputFormat}
                  onChange={(e) => updateJSONCommon('outputFormat', e.target.value)}
                >
                  <option value="text">text</option>
                  <option value="json">json</option>
                </select>
              </div>

              <div className="field-block">
                <label className="field-label">Text style</label>
                <select
                  value={jsonCommon.textStyle}
                  disabled={jsonCommon.outputFormat === 'json'}
                  onChange={(e) => updateJSONCommon('textStyle', e.target.value)}
                >
                  <option value="auto">auto</option>
                  <option value="patch" disabled={jsonPatchBlockedByFilters}>
                    patch
                  </option>
                  <option value="semantic">semantic</option>
                </select>
              </div>
            </section>

            <details className="advanced-panel">
              <summary className="advanced-summary">Advanced options</summary>

              <div className="field-block">
                <label className="field-label">Fail on</label>
                <select
                  value={jsonCommon.failOn}
                  onChange={(e) => updateJSONCommon('failOn', e.target.value)}
                >
                  <option value="none">none</option>
                  <option value="breaking">breaking</option>
                  <option value="any">any</option>
                </select>
              </div>

              <div className="field-block">
                <label className="field-label">Ignore paths</label>
                <textarea
                  className="ignore-paths-input"
                  value={jsonIgnorePathsDraft}
                  onChange={(e) => setJSONIgnorePathsDraft(e.target.value)}
                  onBlur={(e) =>
                    updateJSONCommon('ignorePaths', parseIgnorePaths(e.target.value))
                  }
                  placeholder={'user.updated_at\nmeta.request_id'}
                />
                <div className="helper-text">
                  Enter one canonical path per line (exact match), e.g.{' '}
                  <code>user.updated_at</code>.
                </div>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={jsonCommon.showPaths}
                  onChange={(e) => updateJSONCommon('showPaths', e.target.checked)}
                />
                show canonical paths
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={jsonCommon.onlyBreaking}
                  onChange={(e) => updateJSONCommon('onlyBreaking', e.target.checked)}
                />
                only breaking
              </label>
            </details>

            <button onClick={onRun} disabled={loading}>
              {loading ? 'Running...' : 'Run JSON compare'}
            </button>
          </section>
        )}

        {mode === 'spec' && (
          <section className="mode-panel">
            <div className="field-block">
              <h3 className="section-title">Paths</h3>
            </div>

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

            <section className="options-panel">
              <h3>Options</h3>

              <div className="field-block">
                <label className="field-label">Output format</label>
                <select
                  value={specCommon.outputFormat}
                  onChange={(e) => updateSpecCommon('outputFormat', e.target.value)}
                >
                  <option value="text">text</option>
                  <option value="json">json</option>
                </select>
              </div>

              <div className="field-block">
                <label className="field-label">Text style</label>
                <select
                  value={specCommon.textStyle}
                  disabled={specCommon.outputFormat === 'json'}
                  onChange={(e) => updateSpecCommon('textStyle', e.target.value)}
                >
                  <option value="auto">auto</option>
                  <option value="semantic">semantic</option>
                </select>
              </div>
            </section>

            <details className="advanced-panel">
              <summary className="advanced-summary">Advanced options</summary>

              <div className="field-block">
                <label className="field-label">Fail on</label>
                <select
                  value={specCommon.failOn}
                  onChange={(e) => updateSpecCommon('failOn', e.target.value)}
                >
                  <option value="none">none</option>
                  <option value="breaking">breaking</option>
                  <option value="any">any</option>
                </select>
              </div>

              <div className="field-block">
                <label className="field-label">Ignore paths</label>
                <textarea
                  className="ignore-paths-input"
                  value={specIgnorePathsDraft}
                  onChange={(e) => setSpecIgnorePathsDraft(e.target.value)}
                  onBlur={(e) =>
                    updateSpecCommon('ignorePaths', parseIgnorePaths(e.target.value))
                  }
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
                  checked={specCommon.showPaths}
                  onChange={(e) => updateSpecCommon('showPaths', e.target.checked)}
                />
                show canonical paths
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={specCommon.onlyBreaking}
                  onChange={(e) => updateSpecCommon('onlyBreaking', e.target.checked)}
                />
                only breaking
              </label>
            </details>

            <button onClick={onRun} disabled={loading}>
              {loading ? 'Running...' : 'Run spec compare'}
            </button>
          </section>
        )}

        {mode === 'text' && (
          <section className="mode-panel">
            <section className="options-panel">
              <h3>Options</h3>

              <div className="field-block">
                <label className="field-label">Output format</label>
                <select
                  value={textCommon.outputFormat}
                  onChange={(e) => updateTextCommon('outputFormat', e.target.value)}
                >
                  <option value="text">text</option>
                  <option value="json">json</option>
                </select>
              </div>

              <div className="field-block">
                <label className="field-label">Fail on</label>
                <select
                  value={textCommon.failOn}
                  onChange={(e) => updateTextCommon('failOn', e.target.value)}
                >
                  <option value="none">none</option>
                  <option value="breaking">breaking</option>
                  <option value="any">any</option>
                </select>
              </div>
            </section>

            <button onClick={onRun} disabled={loading}>
              {loading ? 'Running...' : 'Run text compare'}
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

            {scenarioListStatus ? <div className="muted">{scenarioListStatus}</div> : null}

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
        {mode === 'text' ? (
          <div className="text-workspace">
            <h2>Text Compare</h2>
            <div className="text-editors-row">
              <div className="text-editor-panel">
                <label className="field-label">Old text</label>
                <textarea
                  className="text-editor"
                  value={textOld}
                  onChange={(e) => setTextOld(e.target.value)}
                />
              </div>
              <div className="text-editor-panel">
                <label className="field-label">New text</label>
                <textarea
                  className="text-editor"
                  value={textNew}
                  onChange={(e) => setTextNew(e.target.value)}
                />
              </div>
            </div>
            {renderTextResultPanel()}
          </div>
        ) : (
          <>
            <h2>Result</h2>
            {mode === 'scenario' ? (
              renderScenarioResultPanel()
            ) : (
              <>
                {summaryLine ? <div className="result-summary">{summaryLine}</div> : null}
                <pre className="result-output">{output || '(no output yet)'}</pre>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
