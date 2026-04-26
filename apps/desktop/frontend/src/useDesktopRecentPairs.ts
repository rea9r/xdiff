import { useState } from 'react'
import type { DesktopRecentDirectoryPair, DesktopRecentPair } from './types'

export function useDesktopRecentPairs() {
  const [jsonRecentPairs, setJSONRecentPairs] = useState<DesktopRecentPair[]>([])
  const [textRecentPairs, setTextRecentPairs] = useState<DesktopRecentPair[]>([])
  const [directoryRecentPairs, setDirectoryRecentPairs] = useState<DesktopRecentDirectoryPair[]>(
    [],
  )

  return {
    jsonRecentPairs,
    setJSONRecentPairs,
    textRecentPairs,
    setTextRecentPairs,
    directoryRecentPairs,
    setDirectoryRecentPairs,
  }
}

export type DesktopRecentPairsState = ReturnType<typeof useDesktopRecentPairs>
