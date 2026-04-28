import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useDesktopBridge } from '../../useDesktopBridge'
import type { AISetupPhase, AISetupProgress } from '../../types'
import { formatUnknownError } from '../../utils/appHelpers'

const POLL_INTERVAL_MS = 500
const ETA_MIN_SAMPLES = 5
const ETA_MAX_SAMPLES = 10
const READY_FLASH_MS = 1500

export type AISetupContextValue = {
  progress: AISetupProgress | null
  isSettingUp: boolean
  etaMs: number | null
  isReadyFlash: boolean
  start: (req: { model?: string }) => Promise<void>
  cancel: () => Promise<void>
  dismissReady: () => void
  dismissError: () => void
}

const NOOP_CONTEXT: AISetupContextValue = {
  progress: null,
  isSettingUp: false,
  etaMs: null,
  isReadyFlash: false,
  start: async () => {},
  cancel: async () => {},
  dismissReady: () => {},
  dismissError: () => {},
}

const AISetupContext = createContext<AISetupContextValue>(NOOP_CONTEXT)

export function AISetupProvider({ children }: { children: ReactNode }) {
  const { startAISetup, aiSetupProgress, cancelAISetup } = useDesktopBridge()

  const [progress, setProgress] = useState<AISetupProgress | null>(null)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [etaMs, setEtaMs] = useState<number | null>(null)
  const [isReadyFlash, setIsReadyFlash] = useState(false)

  const samplesRef = useRef<{ t: number; bytes: number }[]>([])
  const prevPhaseRef = useRef<AISetupPhase | undefined>(undefined)

  // On mount: pick up any in-flight setup that survived an app reload.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const p = await aiSetupProgress()
        if (cancelled) return
        const inFlight =
          p.phase === 'starting' || p.phase === 'waiting' || p.phase === 'pulling'
        if (inFlight) {
          setProgress(p)
          setIsSettingUp(true)
        }
      } catch {
        /* noop */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [aiSetupProgress])

  // Poll while a setup run is in flight.
  useEffect(() => {
    if (!isSettingUp) return
    let cancelled = false
    const tick = async () => {
      try {
        const p = await aiSetupProgress()
        if (cancelled) return
        setProgress(p)
        if (p.phase === 'ready' || p.phase === 'error') {
          setIsSettingUp(false)
        }
      } catch (e) {
        if (cancelled) return
        setIsSettingUp(false)
        setProgress({ phase: 'error', error: formatUnknownError(e) })
      }
    }
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [isSettingUp, aiSetupProgress])

  // ETA: rolling window of (timestamp, completed-bytes) samples while pulling.
  useEffect(() => {
    if (!progress || progress.phase !== 'pulling') {
      samplesRef.current = []
      setEtaMs(null)
      return
    }
    const completed = progress.pullCompleted ?? 0
    const total = progress.pullTotal ?? 0
    if (total <= 0) {
      setEtaMs(null)
      return
    }
    samplesRef.current.push({ t: Date.now(), bytes: completed })
    if (samplesRef.current.length > ETA_MAX_SAMPLES) {
      samplesRef.current.shift()
    }
    if (samplesRef.current.length < ETA_MIN_SAMPLES) {
      setEtaMs(null)
      return
    }
    const first = samplesRef.current[0]
    const last = samplesRef.current[samplesRef.current.length - 1]
    const dt = last.t - first.t
    const dBytes = last.bytes - first.bytes
    if (dt <= 0 || dBytes <= 0) {
      setEtaMs(null)
      return
    }
    const remaining = total - completed
    setEtaMs(remaining / (dBytes / dt))
  }, [progress])

  // Brief "Ready" flash on phase transition into ready, then auto-clear.
  useEffect(() => {
    const prev = prevPhaseRef.current
    const cur = progress?.phase
    prevPhaseRef.current = cur
    if (prev !== 'ready' && cur === 'ready') {
      setIsReadyFlash(true)
      const id = window.setTimeout(() => {
        setIsReadyFlash(false)
        setProgress(null)
      }, READY_FLASH_MS)
      return () => window.clearTimeout(id)
    }
  }, [progress?.phase])

  const start = useCallback(
    async ({ model }: { model?: string }) => {
      setProgress({ phase: 'starting', message: 'Preparing local AI', model })
      samplesRef.current = []
      setEtaMs(null)
      setIsSettingUp(true)
      try {
        await startAISetup({ model })
      } catch (e) {
        setIsSettingUp(false)
        setProgress({ phase: 'error', error: formatUnknownError(e) })
      }
    },
    [startAISetup],
  )

  const cancel = useCallback(async () => {
    try {
      await cancelAISetup()
    } catch {
      /* noop */
    }
    setIsSettingUp(false)
    setProgress(null)
    samplesRef.current = []
    setEtaMs(null)
  }, [cancelAISetup])

  const dismissReady = useCallback(() => {
    setIsReadyFlash(false)
    setProgress(null)
  }, [])

  const dismissError = useCallback(() => {
    setProgress(null)
  }, [])

  return (
    <AISetupContext.Provider
      value={{
        progress,
        isSettingUp,
        etaMs,
        isReadyFlash,
        start,
        cancel,
        dismissReady,
        dismissError,
      }}
    >
      {children}
    </AISetupContext.Provider>
  )
}

export function useAISetup(): AISetupContextValue {
  return useContext(AISetupContext)
}
