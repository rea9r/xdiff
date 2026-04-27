import { useEffect, useState } from 'react'
import type { DiffCommon, Mode } from './types'

const LAST_USED_MODE_STORAGE_KEY = 'xdiff.desktop.lastUsedMode'
const APP_MODES: Mode[] = ['text', 'json', 'directory']

export const defaultJSONCommon: DiffCommon = {
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreEOL: false,
}

export const defaultTextCommon: DiffCommon = {
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreEOL: false,
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
  const [diffOptionsOpened, setDiffOptionsOpened] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_USED_MODE_STORAGE_KEY, mode)
    } catch {
      // ignore storage errors
    }
  }, [mode])

  const onModeChange = (nextMode: Mode) => {
    setMode(nextMode)
    if (nextMode === 'directory') {
      setDiffOptionsOpened(false)
    }
  }

  return {
    mode,
    setMode,
    diffOptionsOpened,
    setDiffOptionsOpened,
    onModeChange,
  }
}
