import { useMemo, useState } from 'react'

type Mode = 'json' | 'spec' | 'scenario'

const defaultCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [] as string[],
  showPaths: false,
  onlyBreaking: false,
  noColor: false,
}

export function App() {
  const [mode, setMode] = useState<Mode>('json')
  const [oldPath, setOldPath] = useState('')
  const [newPath, setNewPath] = useState('')
  const [scenarioPath, setScenarioPath] = useState('')
  const [reportFormat, setReportFormat] = useState<'text' | 'json'>('text')
  const [ignoreOrder, setIgnoreOrder] = useState(false)
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const api = useMemo(
    () => ({
      compareJSON: (window as any).go?.main?.App?.CompareJSONFiles,
      compareSpec: (window as any).go?.main?.App?.CompareSpecFiles,
      runScenario: (window as any).go?.main?.App?.RunScenario,
    }),
    [],
  )

  const run = async () => {
    setLoading(true)
    setOutput('')
    try {
      if (mode === 'json') {
        const fn = api.compareJSON
        if (!fn) throw new Error('Wails bridge not available (CompareJSONFiles)')
        const res = await fn({
          oldPath,
          newPath,
          common: defaultCommon,
          ignoreOrder,
        })
        setOutput(renderResult(res))
        return
      }

      if (mode === 'spec') {
        const fn = api.compareSpec
        if (!fn) throw new Error('Wails bridge not available (CompareSpecFiles)')
        const res = await fn({
          oldPath,
          newPath,
          common: defaultCommon,
        })
        setOutput(renderResult(res))
        return
      }

      const fn = api.runScenario
      if (!fn) throw new Error('Wails bridge not available (RunScenario)')
      const res = await fn({
        scenarioPath,
        reportFormat,
        only: [],
      })
      setOutput(renderResult(res))
    } catch (e) {
      setOutput(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 20, maxWidth: 960, margin: '0 auto' }}>
      <h1>xdiff Desktop (Phase 1)</h1>

      <label>
        Mode:
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={{ marginLeft: 8 }}>
          <option value="json">JSON compare</option>
          <option value="spec">OpenAPI spec compare</option>
          <option value="scenario">Scenario run</option>
        </select>
      </label>

      {mode !== 'scenario' ? (
        <section style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <label>
              Old path:
              <input value={oldPath} onChange={(e) => setOldPath(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>
              New path:
              <input value={newPath} onChange={(e) => setNewPath(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
          </div>
          {mode === 'json' ? (
            <label>
              <input type="checkbox" checked={ignoreOrder} onChange={(e) => setIgnoreOrder(e.target.checked)} /> ignore array order
            </label>
          ) : null}
        </section>
      ) : (
        <section style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <label>
              Scenario path:
              <input value={scenarioPath} onChange={(e) => setScenarioPath(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
          </div>
          <label>
            Report format:
            <select value={reportFormat} onChange={(e) => setReportFormat(e.target.value as 'text' | 'json')} style={{ marginLeft: 8 }}>
              <option value="text">text</option>
              <option value="json">json</option>
            </select>
          </label>
        </section>
      )}

      <div style={{ marginTop: 16 }}>
        <button onClick={run} disabled={loading}>{loading ? 'Running...' : 'Run'}</button>
      </div>

      <section style={{ marginTop: 20 }}>
        <h2>Result</h2>
        <pre style={{ background: '#111', color: '#0f0', padding: 12, minHeight: 220, whiteSpace: 'pre-wrap' }}>{output}</pre>
      </section>
    </main>
  )
}

function renderResult(res: any): string {
  if (typeof res === 'string') return res
  if (!res) return '(no response)'
  if (res.output) return String(res.output)
  return JSON.stringify(res, null, 2)
}
