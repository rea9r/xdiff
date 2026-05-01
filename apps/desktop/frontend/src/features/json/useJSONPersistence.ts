import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { DesktopTabSession } from '../../types'
import { ignorePathsToText } from '../../utils/appHelpers'
import { defaultJSONCommon } from '../../useDesktopModeState'
import {
  commitTabUpdate,
  safeLoadText,
  type LoadTextFileFn,
} from '../../useDesktopPersistence'
import type { DesktopStatePersistor } from '../../useDesktopStatePersistor'

type StateSetter<T> = Dispatch<SetStateAction<T>>

type UseJSONPersistenceOptions = {
  initialJSONSession: DesktopTabSession['json']
  tabId: string
  commit: DesktopStatePersistor['commit']
  loadTextFile?: LoadTextFileFn
  oldSourcePath: string
  newSourcePath: string
  ignoreOrder: boolean
  common: DesktopTabSession['json']['common']
  setIgnoreOrder: StateSetter<boolean>
  setCommon: StateSetter<DesktopTabSession['json']['common']>
  setIgnorePathsDraft: StateSetter<string>
  setOldSourcePath: StateSetter<string>
  setNewSourcePath: StateSetter<string>
  setOldText: StateSetter<string>
  setNewText: StateSetter<string>
}

export function useJSONPersistence({
  initialJSONSession,
  tabId,
  commit,
  loadTextFile,
  oldSourcePath,
  newSourcePath,
  ignoreOrder,
  common,
  setIgnoreOrder,
  setCommon,
  setIgnorePathsDraft,
  setOldSourcePath,
  setNewSourcePath,
  setOldText,
  setNewText,
}: UseJSONPersistenceOptions) {
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current) {
      return
    }

    let active = true

    const hydrate = async () => {
      try {
        setIgnoreOrder(!!initialJSONSession.ignoreOrder)
        const merged = { ...defaultJSONCommon, ...initialJSONSession.common }
        setCommon(merged)
        setIgnorePathsDraft(ignorePathsToText(merged.ignorePaths))
        setOldSourcePath(initialJSONSession.oldSourcePath || '')
        setNewSourcePath(initialJSONSession.newSourcePath || '')

        const [oldLoaded, newLoaded] = await Promise.all([
          safeLoadText(loadTextFile, initialJSONSession.oldSourcePath || ''),
          safeLoadText(loadTextFile, initialJSONSession.newSourcePath || ''),
        ])
        if (!active) {
          return
        }
        setOldText(oldLoaded)
        setNewText(newLoaded)
      } catch {
        // keep app usable even when hydration fails
      } finally {
        if (active) {
          hydratedRef.current = true
        }
      }
    }

    void hydrate()
    return () => {
      active = false
    }
  }, [
    initialJSONSession,
    loadTextFile,
    setCommon,
    setIgnoreOrder,
    setIgnorePathsDraft,
    setNewSourcePath,
    setNewText,
    setOldSourcePath,
    setOldText,
  ])

  useEffect(() => {
    if (!hydratedRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      commitTabUpdate(commit, tabId, (session) => ({
        ...session,
        json: {
          oldSourcePath,
          newSourcePath,
          ignoreOrder,
          common,
        },
      }))
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [commit, tabId, oldSourcePath, newSourcePath, ignoreOrder, common])
}
