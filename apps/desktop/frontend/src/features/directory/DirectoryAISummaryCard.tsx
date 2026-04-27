import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconChevronDown, IconRefresh, IconSparkles } from '@tabler/icons-react'
import { useDesktopBridge } from '../../useDesktopBridge'
import { EventsOff, EventsOn } from '../../../wailsjs/runtime/runtime'
import type { AIProviderStatus } from '../../types'
import { formatUnknownError } from '../../utils/appHelpers'
import { ExplanationMarkdown } from '../ai/ExplanationMarkdown'
import { AIExplainDrawer } from '../ai/AIExplainDrawer'

const LANGUAGE_STORAGE_KEY = 'xdiff.ai.explainLanguage'
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

export type DirectoryAISummaryCardProps = {
  diffText: string
  changedCount: number
}

export function DirectoryAISummaryCard({ diffText, changedCount }: DirectoryAISummaryCardProps) {
  const { aiProviderStatus, explainDiffStream } = useDesktopBridge()

  const [opened, setOpened] = useState(false)
  const [status, setStatus] = useState<AIProviderStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [explanation, setExplanation] = useState('')
  const [thinking, setThinking] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [usedProvider, setUsedProvider] = useState<string | null>(null)
  const [usedModel, setUsedModel] = useState<string | null>(null)
  const [language, setLanguage] = useState<string>(loadStoredLanguage)
  const [setupDrawerOpen, setSetupDrawerOpen] = useState(false)

  const activeStreamIdRef = useRef<string | null>(null)
  const lastDiffRef = useRef<string>('')

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

  const runExplain = useCallback(
    async (modelOverride?: string) => {
      if (!diffText.trim()) return
      const s = status ?? (await refreshStatus())
      if (!s?.available) return
      const model = modelOverride ?? s.models?.[0] ?? ''
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
          diffText,
          mode: 'directory',
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
        if (res.model) setUsedModel(res.model)
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
    },
    [diffText, explainDiffStream, language, refreshStatus, status],
  )

  // When the user expands the card, check status and auto-generate if ready
  // and we haven't generated for this diff yet.
  useEffect(() => {
    if (!opened) return
    if (!diffText.trim()) return
    let cancelled = false
    void (async () => {
      const s = await refreshStatus()
      if (cancelled) return
      if (s?.available && lastDiffRef.current !== diffText) {
        lastDiffRef.current = diffText
        void runExplain()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [opened, diffText, refreshStatus, runExplain])

  // Cleanup any pending stream listeners on unmount
  useEffect(() => {
    return () => {
      const id = activeStreamIdRef.current
      if (id) {
        EventsOff(`ai-explain-chunk-${id}`)
        EventsOff(`ai-explain-thinking-${id}`)
        activeStreamIdRef.current = null
      }
    }
  }, [])

  // Diff content changed (e.g. user reran directory diff) — invalidate stale summary
  useEffect(() => {
    if (lastDiffRef.current && lastDiffRef.current !== diffText) {
      setExplanation('')
      setThinking('')
      setError(null)
      lastDiffRef.current = ''
    }
  }, [diffText])

  const handleLanguageChange = useCallback((value: string | null) => {
    const next = value ?? 'English'
    setLanguage(next)
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch {
      /* noop */
    }
    lastDiffRef.current = ''
  }, [])

  const handleSetupDrawerClose = useCallback(() => {
    setSetupDrawerOpen(false)
    void (async () => {
      const s = await refreshStatus()
      if (s?.available && diffText.trim() && lastDiffRef.current !== diffText) {
        lastDiffRef.current = diffText
        void runExplain()
      }
    })()
  }, [diffText, refreshStatus, runExplain])

  if (!opened) {
    return (
      <button
        type="button"
        className="directory-ai-cta"
        onClick={() => setOpened(true)}
        aria-label="Summarize this diff with local AI"
      >
        <IconSparkles size={14} />
        <span className="directory-ai-cta-label">Summarize this diff with local AI</span>
        {changedCount > 0 ? (
          <span className="directory-ai-cta-hint">{changedCount} entries differ</span>
        ) : null}
      </button>
    )
  }

  return (
    <>
      <div className="directory-ai-card">
        <div className="directory-ai-card-header">
          <button
            type="button"
            className="directory-ai-card-toggle"
            onClick={() => setOpened(false)}
            aria-expanded={true}
            aria-label="Collapse AI summary"
          >
            <IconChevronDown size={14} className="directory-ai-card-chevron" />
            <IconSparkles size={14} />
            <Text size="sm" fw={600}>
              AI summary
            </Text>
            {usedProvider ? (
              <Badge size="xs" variant="light" color="blue">
                {usedProvider}
              </Badge>
            ) : null}
            {usedModel ? (
              <Text size="xs" c="dimmed" ff="monospace" truncate>
                {usedModel}
              </Text>
            ) : null}
          </button>
          <Group gap={4} wrap="nowrap">
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
                disabled={isLoading || !status?.available || !diffText.trim()}
                aria-label="Regenerate"
              >
                <IconRefresh size={13} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </div>

        <div className="directory-ai-card-body">
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

          {status && !status.available ? (
            <Alert color="blue" variant="light" title="Local AI not set up">
              <Stack gap={6}>
                <Text size="sm">
                  {status.error ??
                    'Install Ollama and pull a model to summarize directory diffs locally.'}
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
                  {thinking ? 'Thinking…' : 'Generating summary…'}
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

          {explanation ? (
            <ExplanationMarkdown content={isLoading ? explanation + ' ▋' : explanation} />
          ) : null}
        </div>
      </div>

      <AIExplainDrawer
        opened={setupDrawerOpen}
        onClose={handleSetupDrawerClose}
        diffText=""
        mode="directory"
      />
    </>
  )
}
