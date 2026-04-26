import { useEffect, useRef, useState } from 'react'
import type { DesktopRecentDirectoryPair, DesktopRecentPair, DesktopState } from './types'
import type { DesktopStatePersistor } from './useDesktopStatePersistor'

export type UseDesktopRecentPairsOptions = {
  initial: DesktopState
  commit: DesktopStatePersistor['commit']
}

export function useDesktopRecentPairs({ initial, commit }: UseDesktopRecentPairsOptions) {
  const [jsonRecentPairs, setJSONRecentPairs] = useState<DesktopRecentPair[]>(
    initial.jsonRecentPairs,
  )
  const [textRecentPairs, setTextRecentPairs] = useState<DesktopRecentPair[]>(
    initial.textRecentPairs,
  )
  const [directoryRecentPairs, setDirectoryRecentPairs] = useState<DesktopRecentDirectoryPair[]>(
    initial.directoryRecentPairs,
  )

  const isFirstSyncRef = useRef(true)
  useEffect(() => {
    if (isFirstSyncRef.current) {
      isFirstSyncRef.current = false
      return
    }
    commit((prev) => ({
      ...prev,
      jsonRecentPairs,
      textRecentPairs,
      directoryRecentPairs,
    }))
  }, [jsonRecentPairs, textRecentPairs, directoryRecentPairs, commit])

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
