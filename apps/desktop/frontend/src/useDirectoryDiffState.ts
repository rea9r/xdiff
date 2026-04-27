import { useState } from 'react'
import type { DiffDirectoriesResponse } from './types'

export function useDirectoryDiffState() {
  const [directoryLeftRoot, setDirectoryLeftRoot] = useState('')
  const [directoryRightRoot, setDirectoryRightRoot] = useState('')
  const [directoryNameFilter, setDirectoryNameFilter] = useState('')
  const [directoryCurrentPath, setDirectoryCurrentPath] = useState('')
  const [directoryResult, setDirectoryResult] = useState<DiffDirectoriesResponse | null>(null)
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
