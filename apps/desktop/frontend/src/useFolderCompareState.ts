import { useState } from 'react'
import type { CompareFoldersResponse, DesktopRecentFolderPair } from './types'

export function useFolderCompareState() {
  const [folderLeftRoot, setFolderLeftRoot] = useState('')
  const [folderRightRoot, setFolderRightRoot] = useState('')
  const [folderNameFilter, setFolderNameFilter] = useState('')
  const [folderCurrentPath, setFolderCurrentPath] = useState('')
  const [folderResult, setFolderResult] = useState<CompareFoldersResponse | null>(null)
  const [folderStatus, setFolderStatus] = useState('')
  const [folderRecentPairs, setFolderRecentPairs] = useState<DesktopRecentFolderPair[]>([])

  return {
    folderLeftRoot,
    setFolderLeftRoot,
    folderRightRoot,
    setFolderRightRoot,
    folderNameFilter,
    setFolderNameFilter,
    folderCurrentPath,
    setFolderCurrentPath,
    folderResult,
    setFolderResult,
    folderStatus,
    setFolderStatus,
    folderRecentPairs,
    setFolderRecentPairs,
  }
}
