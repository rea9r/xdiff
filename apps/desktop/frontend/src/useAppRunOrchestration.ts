import { useCallback } from 'react'
import type {
  CompareJSONRichResponse,
  CompareResponse,
  Mode,
} from './types'
import { renderResult, summarizeResponse } from './utils/appHelpers'

type UseAppRunOrchestrationOptions = {
  mode: Mode
  setLoading: (value: boolean) => void
  setSummaryLine: (value: string) => void
  setOutput: (value: string) => void
  runJSON: () => Promise<CompareJSONRichResponse>
  applyJSONResultView: (richResult: CompareJSONRichResponse) => void
  setJSONRichResult: (value: CompareJSONRichResponse | null) => void
  runText: () => Promise<void>
  setTextResult: (value: CompareResponse | null) => void
  setTextLastRunOld: (value: string) => void
  setTextLastRunNew: (value: string) => void
  setTextLastRunOutputFormat: (value: 'text' | 'json' | null) => void
  clearTextExpandedSections: () => void
  runFolderCompare: () => Promise<void>
}

function buildCompareErrorResult(errorText: string): CompareResponse {
  return {
    exitCode: 2,
    diffFound: false,
    output: '',
    error: errorText,
  }
}

function buildJSONErrorResult(errorText: string): CompareJSONRichResponse {
  return {
    result: buildCompareErrorResult(errorText),
    diffText: '',
    summary: {
      added: 0,
      removed: 0,
      changed: 0,
      typeChanged: 0,
    },
    diffs: [],
  }
}

export function useAppRunOrchestration({
  mode,
  setLoading,
  setSummaryLine,
  setOutput,
  runJSON,
  applyJSONResultView,
  setJSONRichResult,
  runText,
  setTextResult,
  setTextLastRunOld,
  setTextLastRunNew,
  setTextLastRunOutputFormat,
  clearTextExpandedSections,
  runFolderCompare,
}: UseAppRunOrchestrationOptions) {
  const setResult = useCallback(
    (res: unknown) => {
      setSummaryLine(summarizeResponse(res))
      setOutput(renderResult(res))
    },
    [setOutput, setSummaryLine],
  )

  const runJSONWithViewReset = useCallback(async () => {
    const richResult = await runJSON()
    applyJSONResultView(richResult)
  }, [applyJSONResultView, runJSON])

  const runByMode = useCallback(async () => {
    if (mode === 'json') {
      await runJSONWithViewReset()
      return
    }
    if (mode === 'text') {
      await runText()
      return
    }
    await runFolderCompare()
  }, [mode, runFolderCompare, runJSONWithViewReset, runText])

  const onRun = useCallback(async () => {
    setLoading(true)
    setSummaryLine('')
    setOutput('')

    if (mode === 'text') {
      setTextResult(null)
      setTextLastRunOld('')
      setTextLastRunNew('')
      setTextLastRunOutputFormat(null)
      clearTextExpandedSections()
    }

    try {
      await runByMode()
    } catch (error) {
      const errorText = String(error)

      if (mode === 'text') {
        setTextResult(buildCompareErrorResult(errorText))
      } else if (mode === 'json') {
        setJSONRichResult(buildJSONErrorResult(errorText))
      }

      setSummaryLine('error=yes')
      setOutput(errorText)
    } finally {
      setLoading(false)
    }
  }, [
    clearTextExpandedSections,
    mode,
    runByMode,
    setJSONRichResult,
    setLoading,
    setOutput,
    setSummaryLine,
    setTextLastRunOld,
    setTextLastRunNew,
    setTextLastRunOutputFormat,
    setTextResult,
  ])

  return {
    setResult,
    onRun,
  }
}
