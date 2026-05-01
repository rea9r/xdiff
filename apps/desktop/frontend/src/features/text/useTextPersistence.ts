import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { DesktopTabSession } from '../../types'
import { defaultTextCommon } from '../../useDesktopModeState'
import {
  commitTabUpdate,
  safeLoadText,
  type LoadTextFileFn,
} from '../../useDesktopPersistence'
import type { DesktopStatePersistor } from '../../useDesktopStatePersistor'

type StateSetter<T> = Dispatch<SetStateAction<T>>

type UseTextPersistenceOptions = {
  initialTextSession: DesktopTabSession['text']
  tabId: string
  commit: DesktopStatePersistor['commit']
  loadTextFile?: LoadTextFileFn
  oldSourcePath: string
  newSourcePath: string
  common: DesktopTabSession['text']['common']
  diffLayout: DesktopTabSession['text']['diffLayout']
  setCommon: StateSetter<DesktopTabSession['text']['common']>
  setDiffLayout: StateSetter<DesktopTabSession['text']['diffLayout']>
  setOldSourcePath: StateSetter<string>
  setNewSourcePath: StateSetter<string>
  setOldText: StateSetter<string>
  setNewText: StateSetter<string>
}

export function useTextPersistence({
  initialTextSession,
  tabId,
  commit,
  loadTextFile,
  oldSourcePath,
  newSourcePath,
  common,
  diffLayout,
  setCommon,
  setDiffLayout,
  setOldSourcePath,
  setNewSourcePath,
  setOldText,
  setNewText,
}: UseTextPersistenceOptions) {
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current) {
      return
    }

    let active = true

    const hydrate = async () => {
      try {
        setCommon({ ...defaultTextCommon, ...initialTextSession.common })
        setDiffLayout(initialTextSession.diffLayout === 'unified' ? 'unified' : 'split')
        setOldSourcePath(initialTextSession.oldSourcePath || '')
        setNewSourcePath(initialTextSession.newSourcePath || '')

        const [oldLoaded, newLoaded] = await Promise.all([
          safeLoadText(loadTextFile, initialTextSession.oldSourcePath || ''),
          safeLoadText(loadTextFile, initialTextSession.newSourcePath || ''),
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
    initialTextSession,
    loadTextFile,
    setCommon,
    setDiffLayout,
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
        text: {
          oldSourcePath,
          newSourcePath,
          common,
          diffLayout,
        },
      }))
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [commit, tabId, oldSourcePath, newSourcePath, common, diffLayout])
}
