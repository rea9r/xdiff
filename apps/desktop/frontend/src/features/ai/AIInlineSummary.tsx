import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Progress,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconChevronDown, IconRefresh, IconSparkles } from '@tabler/icons-react'
import { useDesktopBridge } from '../../useDesktopBridge'
import { EventsOff, EventsOn } from '../../../wailsjs/runtime/runtime'
import type { AIProviderStatus, ExplainDiffMode } from '../../types'
import { formatUnknownError } from '../../utils/appHelpers'
import { ExplanationMarkdown } from './ExplanationMarkdown'
import { AIExplainDrawer } from './AIExplainDrawer'
import { AIModelPicker } from './AIModelPicker'
import { useAISetup } from './AISetupProvider'

const LANGUAGE_STORAGE_KEY = 'xdiff.ai.explainLanguage'
const ACTIVE_MODEL_STORAGE_KEY = 'xdiff.ai.activeModel'
const LANGUAGE_OPTIONS = [
  { value: 'English', label: 'English' },
  { value: 'Japanese', label: '日本語' },
]

function loadStoredLanguage(): string {
  try {
    const v = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (v && LANGUAGE_OPTIONS.some((o) => o.value === v)) return v
  } catch {
    /* noop */
  }
  return 'English'
}

function loadStoredActiveModel(): string {
  try {
    return window.localStorage.getItem(ACTIVE_MODEL_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export type AIInlineSummaryPrepared = {
  diffText: string
  coverage?: ReactNode
}

export type AIInlineSummaryProps = {
  cacheKey: string
  diffText?: string
  prepare?: () => Promise<AIInlineSummaryPrepared>
  ctaLabel: string
  ctaHint?: ReactNode
  mode: ExplainDiffMode
  buildingLabel?: string
}

export function AIInlineSummary({
  cacheKey,
  diffText = '',
  prepare,
  ctaLabel,
  ctaHint,
  mode,
  buildingLabel,
}: AIInlineSummaryProps) {
  const { aiProviderStatus, explainDiffStream } = useDesktopBridge()
  const { progress: setupProgress, cancel: cancelSetup } = useAISetup()

  const [opened, setOpened] = useState(false)
  const [status, setStatus] = useState<AIProviderStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [explanation, setExplanation] = useState('')
  const [thinking, setThinking] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [coverage, setCoverage] = useState<ReactNode>(null)
  const [usedProvider, setUsedProvider] = useState<string | null>(null)
  const [activeModel, setActiveModel] = useState<string>(loadStoredActiveModel)
  const [language, setLanguage] = useState<string>(loadStoredLanguage)
  const [setupDrawerOpen, setSetupDrawerOpen] = useState(false)
  const [drawerStartsInAdd, setDrawerStartsInAdd] = useState(false)

  const activeStreamIdRef = useRef<string | null>(null)
  const lastInternalCacheKeyRef = useRef<string>('')
  const prepareRef = useRef(prepare)
  prepareRef.current = prepare
  const prevSetupPhaseRef = useRef<string | undefined>(undefined)

  const refreshStatus = useCallback(async () => {
    try {
      const s = await aiProviderStatus()
      setStatus(s)
      setStatusError(null)
      return s
    } catch (e) {
      setStatusError(formatUnknownError(e))
      return null
    }
  }, [aiProviderStatus])

  // When a global setup completes, refresh local status so the new model
  // shows up in the picker. The reconcile effect below handles auto-pick.
  useEffect(() => {
    const prev = prevSetupPhaseRef.current
    const cur = setupProgress?.phase
    prevSetupPhaseRef.current = cur
    if (prev !== 'ready' && cur === 'ready') {
      void refreshStatus()
    }
  }, [setupProgress?.phase, refreshStatus])

  // Reconcile activeModel with the installed model list.
  // - If nothing installed: clear it.
  // - If current pick is missing (deleted, never installed): fall back to the
  //   stored preference if it's available, else first model.
  useEffect(() => {
    if (!status?.available) return
    const models = status.models ?? []
    if (models.length === 0) {
      if (activeModel) setActiveModel('')
      return
    }
    if (activeModel && models.includes(activeModel)) return
    const stored = loadStoredActiveModel()
    const next = stored && models.includes(stored) ? stored : models[0]!
    setActiveModel(next)
  }, [status, activeModel])

  const internalCacheKey = `${cacheKey}#m=${activeModel}#l=${language}`

  const runExplain = useCallback(async () => {
    const s = status ?? (await refreshStatus())
    if (!s?.available) return
    const model = activeModel || s.models?.[0] || ''
    if (!model) return

    const prevId = activeStreamIdRef.current
    if (prevId) {
      EventsOff(`ai-explain-chunk-${prevId}`)
      EventsOff(`ai-explain-thinking-${prevId}`)
    }
    const streamId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    activeStreamIdRef.current = streamId

    setIsLoading(true)
    setError(null)
    setExplanation('')
    setThinking('')
    setCoverage(null)

    let textToExplain = diffText
    if (prepareRef.current) {
      setIsPreparing(true)
      try {
        const prepared = await prepareRef.current()
        if (activeStreamIdRef.current !== streamId) return
        textToExplain = prepared.diffText
        setCoverage(prepared.coverage ?? null)
      } catch (e) {
        if (activeStreamIdRef.current === streamId) {
          setError(formatUnknownError(e))
          setIsLoading(false)
          setIsPreparing(false)
          activeStreamIdRef.current = null
        }
        return
      } finally {
        if (activeStreamIdRef.current === streamId) setIsPreparing(false)
      }
    }

    if (!textToExplain.trim()) {
      if (activeStreamIdRef.current === streamId) {
        setError('Nothing to explain.')
        setIsLoading(false)
        activeStreamIdRef.current = null
      }
      return
    }

    EventsOn(`ai-explain-chunk-${streamId}`, (chunk: string) => {
      if (activeStreamIdRef.current !== streamId) return
      setExplanation((prev) => prev + chunk)
    })
    EventsOn(`ai-explain-thinking-${streamId}`, (chunk: string) => {
      if (activeStreamIdRef.current !== streamId) return
      setThinking((prev) => prev + chunk)
    })

    try {
      const res = await explainDiffStream({
        diffText: textToExplain,
        mode,
        model,
        language,
        streamId,
      })
      if (activeStreamIdRef.current !== streamId) return
      if (res.error) {
        setError(res.error)
      } else {
        setExplanation(res.explanation)
      }
      if (res.provider) setUsedProvider(res.provider)
    } catch (e) {
      if (activeStreamIdRef.current !== streamId) return
      setError(formatUnknownError(e))
    } finally {
      if (activeStreamIdRef.current === streamId) {
        setIsLoading(false)
        activeStreamIdRef.current = null
      }
      EventsOff(`ai-explain-chunk-${streamId}`)
      EventsOff(`ai-explain-thinking-${streamId}`)
    }
  }, [activeModel, diffText, explainDiffStream, language, mode, refreshStatus, status])

  useEffect(() => {
    if (!opened) return
    let cancelled = false
    void (async () => {
      const s = await refreshStatus()
      if (cancelled) return
      if (
        s?.available &&
        activeModel &&
        lastInternalCacheKeyRef.current !== internalCacheKey
      ) {
        lastInternalCacheKeyRef.current = internalCacheKey
        void runExplain()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [opened, internalCacheKey, activeModel, refreshStatus, runExplain])

  useEffect(
    () => () => {
      const id = activeStreamIdRef.current
      if (id) {
        EventsOff(`ai-explain-chunk-${id}`)
        EventsOff(`ai-explain-thinking-${id}`)
        activeStreamIdRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    if (
      lastInternalCacheKeyRef.current &&
      lastInternalCacheKeyRef.current !== internalCacheKey
    ) {
      setExplanation('')
      setThinking('')
      setError(null)
      setCoverage(null)
      lastInternalCacheKeyRef.current = ''
    }
  }, [internalCacheKey])

  const handleLanguageChange = useCallback((value: string | null) => {
    const next = value ?? 'English'
    setLanguage(next)
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch {
      /* noop */
    }
  }, [])

  const handleActiveModelChange = useCallback((m: string) => {
    setActiveModel(m)
    try {
      window.localStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, m)
    } catch {
      /* noop */
    }
  }, [])

  const handleAddModel = useCallback(() => {
    setDrawerStartsInAdd(true)
    setSetupDrawerOpen(true)
  }, [])

  const handleSetupDrawerClose = useCallback(() => {
    setSetupDrawerOpen(false)
    setDrawerStartsInAdd(false)
    void (async () => {
      const s = await refreshStatus()
      if (
        s?.available &&
        activeModel &&
        lastInternalCacheKeyRef.current !== internalCacheKey
      ) {
        lastInternalCacheKeyRef.current = internalCacheKey
        void runExplain()
      }
    })()
  }, [activeModel, internalCacheKey, refreshStatus, runExplain])

  const setupPhase = setupProgress?.phase
  const setupInProgress =
    setupPhase === 'starting' || setupPhase === 'waiting' || setupPhase === 'pulling'
  const setupPullPercent = Math.round(setupProgress?.pullPercent ?? 0)

  if (!opened) {
    if (setupInProgress) {
      const ctaLabelText =
        setupPhase === 'pulling'
          ? `Pulling ${setupProgress?.model ?? 'model'} · ${setupPullPercent}%`
          : setupPhase === 'starting'
            ? 'Starting Ollama…'
            : 'Waiting for Ollama…'
      return (
        <button
          type="button"
          className="ai-inline-cta is-progress"
          onClick={() => setOpened(true)}
          aria-label={ctaLabelText}
        >
          <Loader size={12} color="currentColor" />
          <span className="ai-inline-cta-label">{ctaLabelText}</span>
          <span
            className="ai-inline-cta-bar"
            aria-hidden="true"
            style={
              {
                '--ai-cta-progress': `${
                  setupPhase === 'pulling' ? setupPullPercent : 0
                }%`,
              } as React.CSSProperties
            }
          />
        </button>
      )
    }
    return (
      <button
        type="button"
        className="ai-inline-cta"
        onClick={() => setOpened(true)}
        aria-label={ctaLabel}
      >
        <IconSparkles size={14} />
        <span className="ai-inline-cta-label">{ctaLabel}</span>
        {ctaHint ? <span className="ai-inline-cta-hint">{ctaHint}</span> : null}
      </button>
    )
  }

  const loadingLabel = isPreparing
    ? (buildingLabel ?? 'Preparing diff…')
    : thinking
      ? 'Thinking…'
      : 'Generating summary…'

  const installedModels = status?.models ?? []

  return (
    <>
      <div className="ai-inline-card">
        <div className="ai-inline-card-header">
          <button
            type="button"
            className="ai-inline-card-toggle"
            onClick={() => setOpened(false)}
            aria-expanded={true}
            aria-label="Collapse AI summary"
          >
            <IconChevronDown size={14} className="ai-inline-card-chevron" />
            <IconSparkles size={14} />
            <Text size="sm" fw={600}>
              AI summary
            </Text>
            {usedProvider ? (
              <Badge size="xs" variant="light" color="blue">
                {usedProvider}
              </Badge>
            ) : null}
          </button>
          <Group gap={4} wrap="nowrap">
            {status?.available && installedModels.length > 0 ? (
              <AIModelPicker
                models={installedModels}
                activeModel={activeModel}
                onChange={handleActiveModelChange}
                onModelsChanged={async () => {
                  await refreshStatus()
                }}
                onAddModel={handleAddModel}
                onError={setError}
                disabled={isLoading}
              />
            ) : null}
            <Select
              size="xs"
              value={language}
              onChange={handleLanguageChange}
              data={LANGUAGE_OPTIONS}
              style={{ width: 100 }}
              comboboxProps={{ withinPortal: true }}
              allowDeselect={false}
              aria-label="Response language"
            />
            <Tooltip label="Regenerate">
              <ActionIcon
                variant="default"
                size={26}
                onClick={() => void runExplain()}
                disabled={isLoading || !status?.available || !activeModel}
                aria-label="Regenerate"
              >
                <IconRefresh size={13} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </div>

        <div className="ai-inline-card-body">
          {setupInProgress ? (
            <div className="ai-inline-progress-row">
              <Loader size="xs" />
              <div className="ai-inline-progress-text">
                <Text size="xs" fw={500}>
                  {setupPhase === 'pulling'
                    ? `Pulling ${setupProgress?.model ?? 'model'}`
                    : setupPhase === 'starting'
                      ? 'Starting Ollama'
                      : 'Waiting for Ollama'}
                </Text>
                {setupPhase === 'pulling' && (setupProgress?.pullTotal ?? 0) > 0 ? (
                  <Progress value={setupProgress?.pullPercent ?? 0} size="xs" mt={4} />
                ) : null}
              </div>
              <Text
                size="xs"
                c="dimmed"
                style={{ fontVariantNumeric: 'tabular-nums', flex: 'none' }}
              >
                {setupPhase === 'pulling' ? `${setupPullPercent}%` : ''}
              </Text>
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={() => void cancelSetup()}
              >
                Cancel
              </Button>
            </div>
          ) : null}

          {!status && !statusError ? (
            <Group gap="xs">
              <Loader size="xs" />
              <Text size="sm" c="dimmed">
                Checking local AI…
              </Text>
            </Group>
          ) : null}

          {statusError ? (
            <Alert color="red" variant="light" title="Could not reach local AI">
              <Stack gap={6}>
                <Text size="sm">{statusError}</Text>
                <Group gap="xs">
                  <Button size="xs" onClick={() => void refreshStatus()}>
                    Retry
                  </Button>
                </Group>
              </Stack>
            </Alert>
          ) : null}

          {status && !status.available && !setupInProgress ? (
            <Alert color="blue" variant="light" title="Local AI not set up">
              <Stack gap={6}>
                <Text size="sm">
                  {status.error ?? 'Install Ollama and pull a model to use local AI.'}
                </Text>
                <Group gap="xs">
                  <Button size="xs" onClick={() => setSetupDrawerOpen(true)}>
                    Set up local AI
                  </Button>
                </Group>
              </Stack>
            </Alert>
          ) : null}

          {status?.available && isLoading && !explanation ? (
            <Stack gap={6}>
              <Group gap="xs">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">
                  {loadingLabel}
                </Text>
              </Group>
              {thinking ? (
                <Text
                  size="xs"
                  c="dimmed"
                  fs="italic"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {thinking.length > 500 ? '… ' + thinking.slice(-500) : thinking}
                </Text>
              ) : null}
            </Stack>
          ) : null}

          {error ? (
            <Alert color="red" variant="light" title="Failed to summarize">
              <Stack gap={6}>
                <Text size="sm">{error}</Text>
                <Group gap="xs">
                  <Button size="xs" onClick={() => void runExplain()}>
                    Retry
                  </Button>
                </Group>
              </Stack>
            </Alert>
          ) : null}

          {coverage ?? null}

          {explanation ? (
            <ExplanationMarkdown content={isLoading ? explanation + ' ▋' : explanation} />
          ) : null}
        </div>
      </div>

      <AIExplainDrawer
        opened={setupDrawerOpen}
        onClose={handleSetupDrawerClose}
        diffText=""
        mode={mode}
        startInAddModel={drawerStartsInAdd}
      />
    </>
  )
}
