import { useState } from 'react'

export function useDesktopRunUiState() {
  const [summaryLine, setSummaryLine] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  return {
    summaryLine,
    setSummaryLine,
    output,
    setOutput,
    loading,
    setLoading,
  }
}
