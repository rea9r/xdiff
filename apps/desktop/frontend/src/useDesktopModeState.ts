import { useEffect, useState } from 'react'
import type { CompareCommon, Mode } from './types'

const LAST_USED_MODE_STORAGE_KEY = 'xdiff.desktop.lastUsedMode'
const APP_MODES: Mode[] = ['text', 'json', 'folder', 'scenario']

export const defaultJSONCommon: CompareCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

export const defaultTextCommon: CompareCommon = {
  failOn: 'any',
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

function isMode(value: string): value is Mode {
  return APP_MODES.includes(value as Mode)
}

function getInitialMode(): Mode {
  const fallback: Mode = 'json'

  try {
    const raw = window.localStorage.getItem(LAST_USED_MODE_STORAGE_KEY)
    if (!raw) {
      return fallback
    }

    return isMode(raw) ? raw : fallback
  } catch {
    return fallback
  }
}

export function useDesktopModeState() {
  const [mode, setMode] = useState<Mode>(() => getInitialMode())
  const [compareOptionsOpened, setCompareOptionsOpened] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_USED_MODE_STORAGE_KEY, mode)
    } catch {
      // ignore storage errors
    }
  }, [mode])

  const onModeChange = (nextMode: Mode) => {
    setMode(nextMode)
    if (nextMode === 'folder' || nextMode === 'scenario') {
      setCompareOptionsOpened(false)
    }
  }

  return {
    mode,
    setMode,
    compareOptionsOpened,
    setCompareOptionsOpened,
    onModeChange,
  }
}
