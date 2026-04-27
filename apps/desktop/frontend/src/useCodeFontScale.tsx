import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'xdiff:code-font-scale'
const DEFAULT_SCALE = 1
const SCALE_PRESETS = [0.85, 1, 1.15, 1.3, 1.45] as const

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCALE
  const min = SCALE_PRESETS[0]
  const max = SCALE_PRESETS[SCALE_PRESETS.length - 1]
  if (value < min) return min
  if (value > max) return max
  return value
}

function loadInitialScale(): number {
  if (typeof window === 'undefined') return DEFAULT_SCALE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SCALE
    return clampScale(Number.parseFloat(raw))
  } catch {
    return DEFAULT_SCALE
  }
}

function indexOfPreset(value: number): number {
  let bestIndex = 0
  let bestDelta = Math.abs(SCALE_PRESETS[0] - value)
  for (let i = 1; i < SCALE_PRESETS.length; i++) {
    const delta = Math.abs(SCALE_PRESETS[i] - value)
    if (delta < bestDelta) {
      bestDelta = delta
      bestIndex = i
    }
  }
  return bestIndex
}

type CodeFontScaleContextValue = {
  scale: number
  presets: readonly number[]
  setScale: (value: number) => void
  increase: () => void
  decrease: () => void
  reset: () => void
}

const CodeFontScaleContext = createContext<CodeFontScaleContextValue | null>(null)

export function CodeFontScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<number>(() => loadInitialScale())

  useEffect(() => {
    document.documentElement.style.setProperty('--xdiff-code-scale', String(scale))
    try {
      window.localStorage.setItem(STORAGE_KEY, String(scale))
    } catch {
      // ignore quota / disabled storage
    }
  }, [scale])

  const setScale = useCallback((value: number) => {
    setScaleState(clampScale(value))
  }, [])

  const increase = useCallback(() => {
    setScaleState((prev) => {
      const idx = indexOfPreset(prev)
      return SCALE_PRESETS[Math.min(idx + 1, SCALE_PRESETS.length - 1)]
    })
  }, [])

  const decrease = useCallback(() => {
    setScaleState((prev) => {
      const idx = indexOfPreset(prev)
      return SCALE_PRESETS[Math.max(idx - 1, 0)]
    })
  }, [])

  const reset = useCallback(() => {
    setScaleState(DEFAULT_SCALE)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const ctrlOrCmd = event.ctrlKey || event.metaKey
      if (!ctrlOrCmd || event.altKey) {
        return
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        increase()
        return
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        decrease()
        return
      }
      if (event.key === '0') {
        event.preventDefault()
        reset()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [increase, decrease, reset])

  return (
    <CodeFontScaleContext.Provider
      value={{ scale, presets: SCALE_PRESETS, setScale, increase, decrease, reset }}
    >
      {children}
    </CodeFontScaleContext.Provider>
  )
}

const NOOP_CODE_FONT_SCALE: CodeFontScaleContextValue = {
  scale: DEFAULT_SCALE,
  presets: SCALE_PRESETS,
  setScale: () => {},
  increase: () => {},
  decrease: () => {},
  reset: () => {},
}

export function useCodeFontScale(): CodeFontScaleContextValue {
  return useContext(CodeFontScaleContext) ?? NOOP_CODE_FONT_SCALE
}

export function formatCodeFontScalePercent(scale: number): string {
  return `${Math.round(scale * 100)}%`
}
