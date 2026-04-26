import { useState } from 'react'
import type { CompareDirectoriesResponse } from './types'

export function useDirectoryCompareState() {
  const [directoryLeftRoot, setDirectoryLeftRoot] = useState('')
  const [directoryRightRoot, setDirectoryRightRoot] = useState('')
  const [directoryNameFilter, setDirectoryNameFilter] = useState('')
  const [directoryCurrentPath, setDirectoryCurrentPath] = useState('')
  const [directoryResult, setDirectoryResult] = useState<CompareDirectoriesResponse | null>(null)
  const [directoryStatus, setDirectoryStatus] = useState('')

  return {
    directoryLeftRoot,
    setDirectoryLeftRoot,
    directoryRightRoot,
    setDirectoryRightRoot,
    directoryNameFilter,
    setDirectoryNameFilter,
    directoryCurrentPath,
    setDirectoryCurrentPath,
    directoryResult,
    setDirectoryResult,
    directoryStatus,
    setDirectoryStatus,
  }
}
