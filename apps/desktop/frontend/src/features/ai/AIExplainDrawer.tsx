import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Loader,
  Popover,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import {
  IconArrowsExchange,
  IconCheck,
  IconChevronDown,
  IconLock,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconWallet,
} from '@tabler/icons-react'
import { ExplanationMarkdown } from './ExplanationMarkdown'
import { useAISetup } from './AISetupProvider'
import { useDesktopBridge } from '../../useDesktopBridge'
import { EventsOff, EventsOn } from '../../../wailsjs/runtime/runtime'
import type {
  AIProviderStatus,
  AISetupPhase,
  ExplainDiffMode,
  HardwareTier,
} from '../../types'
import { formatUnknownError } from '../../utils/appHelpers'

export type AIExplainDrawerProps = {
  opened: boolean
  onClose: () => void
  diffText: string
  mode: ExplainDiffMode
  /**
   * When true, the drawer opens with the "Add model" panel pre-expanded.
   * Used when the inline picker delegates the add-model flow here.
   */
  startInAddModel?: boolean
}

type TierId = 'compact' | 'balanced' | 'high'

type Tier = {
  id: TierId
  name: string
  modelId: string
  size: string
  description: string
}

const TIERS: Tier[] = [
  {
    id: 'compact',
    name: 'Compact',
    modelId: 'gemma3:1b',
    size: '~0.8 GB',
    description: 'Fastest. Runs on any laptop.',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    modelId: 'gemma3:4b',
    size: '~3.3 GB',
    description: 'Best for most laptops.',
  },
  {
    id: 'high',
    name: 'High Quality',
    modelId: 'gemma3:12b',
    size: '~8.1 GB',
    description: 'Best output. Needs more RAM.',
  },
]

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

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function describeSetupPhase(phase: AISetupPhase): string {
  switch (phase) {
    case 'starting':
      return 'Starting Ollama'
    case 'waiting':
      return 'Waiting for Ollama'
    case 'pulling':
      return 'Downloading model'
    case 'ready':
      return 'Ready'
    case 'error':
      return 'Failed'
    default:
      return 'Idle'
  }
}

function pickRecommendedTier(hw: HardwareTier | undefined): TierId {
  // Compact is the safest first-impression on most laptops (CPU inference is slow).
  // Only machines with > 16 GB RAM get Balanced as the recommended default.
  return hw === 'high' ? 'balanced' : 'compact'
}

function isTierBlocked(tier: TierId, hw: HardwareTier | undefined): boolean {
  return hw === 'low' && tier === 'high'
}

function formatEta(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return ''
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `~${totalSec}s remaining`
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m < 60) return `~${m}m ${s}s remaining`
  const h = Math.floor(m / 60)
  return `~${h}h ${m % 60}m remaining`
}

function ContextBullets() {
  const items = [
    { icon: IconLock, text: 'Runs locally — your code stays on this machine.' },
    { icon: IconWallet, text: 'Free — no account required.' },
    { icon: IconArrowsExchange, text: 'Switch models anytime.' },
  ]
  return (
    <Stack gap={4}>
      {items.map(({ icon: Icon, text }) => (
        <Group key={text} gap={6} wrap="nowrap" align="center">
          <Icon size={13} style={{ color: 'var(--mantine-color-dimmed)', flex: 'none' }} />
          <Text size="xs" c="dimmed">
            {text}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}

function TierCard({
  tier,
  selected,
  recommended,
  blocked,
  onClick,
}: {
  tier: Tier
  selected: boolean
  recommended: boolean
  blocked: boolean
  onClick: () => void
}) {
  return (
    <Card
      withBorder
      padding="xs"
      onClick={blocked ? undefined : onClick}
      style={{
        cursor: blocked ? 'not-allowed' : 'pointer',
        opacity: blocked ? 0.5 : 1,
        borderColor: selected ? 'var(--mantine-color-blue-filled)' : undefined,
        borderWidth: selected ? 2 : 1,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs" align="start">
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={600}>
              {tier.name}
            </Text>
            {recommended ? (
              <Badge size="xs" variant="light" color="blue">
                Recommended
              </Badge>
            ) : null}
          </Group>
          <Text size="xs" c="dimmed" ff="monospace">
            {tier.modelId}
          </Text>
          <Text size="xs" c="dimmed">
            {tier.description}
          </Text>
          {blocked ? (
            <Text size="xs" c="orange.4">
              Needs more RAM than this machine reports.
            </Text>
          ) : null}
        </Stack>
        <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
          {tier.size}
        </Text>
      </Group>
    </Card>
  )
}

export function AIExplainDrawer({
  opened,
  onClose,
  diffText,
  mode,
  startInAddModel = false,
}: AIExplainDrawerProps) {
  const {
    aiProviderStatus,
    explainDiffStream,
    deleteOllamaModel,
    openOllamaDownloadPage,
  } = useDesktopBridge()

  const {
    progress: setupProgress,
    isSettingUp,
    etaMs,
    isReadyFlash: showReadyFlash,
    start: startSetupFlow,
    cancel: cancelSetupFlow,
    dismissError: dismissSetupError,
  } = useAISetup()

  const [status, setStatus] = useState<AIProviderStatus | null>(null)
  const [explanation, setExplanation] = useState('')
  const [thinking, setThinking] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeModel, setActiveModel] = useState<string>('')
  const [usedProvider, setUsedProvider] = useState<string | null>(null)
  const [usedModel, setUsedModel] = useState<string | null>(null)
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null)
  const [addingModel, setAddingModel] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [confirmDeleteModel, setConfirmDeleteModel] = useState<string | null>(null)
  const [deletingModel, setDeletingModel] = useState<string | null>(null)
  const [language, setLanguage] = useState<string>(loadStoredLanguage)

  const lastDiffRef = useRef<string>('')
  const prevSetupPhaseRef = useRef<AISetupPhase | undefined>(undefined)
  const revertTimeoutRef = useRef<number | null>(null)
  const activeStreamIdRef = useRef<string | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const s = await aiProviderStatus()
      setStatus(s)
      return s
    } catch (e) {
      const fallback: AIProviderStatus = {
        available: false,
        ollamaInstalled: false,
        ollamaReachable: false,
        canAutoStart: false,
        error: formatUnknownError(e),
      }
      setStatus(fallback)
      return fallback
    }
  }, [aiProviderStatus])

  const runExplain = useCallback(
    async (modelOverride?: string) => {
      if (!diffText.trim()) return

      // Detach any prior stream listener before starting a new one.
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
          mode,
          model: modelOverride ?? activeModel,
          language,
          streamId,
        })
        if (activeStreamIdRef.current !== streamId) return
        if (res.error) {
          setError(res.error)
        } else {
          // Trust the final response over accumulated chunks (server trims).
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
    [activeModel, diffText, explainDiffStream, mode, language],
  )

  // Re-detect provider every time the drawer opens — state outside the app
  // (Ollama install, daemon start) may have changed since last open. Also
  // reset the inline add-model picker. When `startInAddModel` is true, the
  // caller (e.g. the inline picker's "Add model" action) wants the drawer to
  // open straight on the add-model panel.
  useEffect(() => {
    if (!opened) return
    setAddingModel(startInAddModel)
    setConfirmDeleteModel(null)
    if (revertTimeoutRef.current !== null) {
      window.clearTimeout(revertTimeoutRef.current)
      revertTimeoutRef.current = null
    }
    if (startInAddModel) setModelMenuOpen(true)
    void refreshStatus()
  }, [opened, refreshStatus, startInAddModel])

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

  // Default selected tier follows hardware tier (low → compact, else balanced).
  const recommendedTier = useMemo(
    () => pickRecommendedTier(status?.hardwareTier),
    [status?.hardwareTier],
  )
  const installedSet = useMemo(
    () => new Set(status?.models ?? []),
    [status?.models],
  )
  const availableTiers = useMemo(
    () => TIERS.filter((t) => !installedSet.has(t.modelId)),
    [installedSet],
  )
  useEffect(() => {
    if (selectedTier) return
    if (!status) return
    setSelectedTier(recommendedTier)
  }, [status, selectedTier, recommendedTier])

  // When the user opens "Add model", make sure the current selection is one
  // they can actually pull — if it's already installed, jump to the next
  // recommended tier (or first available).
  useEffect(() => {
    if (!addingModel) return
    if (availableTiers.length === 0) return
    if (selectedTier && availableTiers.some((t) => t.id === selectedTier)) return
    const recommended = availableTiers.find((t) => t.id === recommendedTier)
    setSelectedTier(recommended?.id ?? availableTiers[0]!.id)
  }, [addingModel, availableTiers, selectedTier, recommendedTier])

  // First-model autopick when status reports availability but we haven't picked one yet.
  useEffect(() => {
    if (!status?.available) return
    if (activeModel) return
    if (status.models && status.models.length > 0) {
      setActiveModel(status.models[0])
    }
  }, [status, activeModel])

  // Auto-explain when a usable provider/model is in place and the diff changed.
  // Do NOT depend on `explanation` here — runExplain calls setExplanation('')
  // at start, which would re-fire this effect and spawn parallel streams.
  // Wait for `activeModel` to settle: when status first reports availability,
  // the auto-pick effect schedules setActiveModel in the same render — firing
  // here too early would send an empty model name and let the backend default
  // kick in, which 404s if that default isn't installed.
  useEffect(() => {
    if (!opened) return
    if (showReadyFlash) return
    if (!status?.available) return
    if (!activeModel) return
    if (!diffText.trim()) return
    if (lastDiffRef.current === diffText) return
    lastDiffRef.current = diffText
    void runExplain()
  }, [opened, status?.available, activeModel, diffText, runExplain, showReadyFlash])

  // React to setup phase transitions sourced from the provider.
  // - On 'ready': close the inline add-model panel, refresh status, and pick
  //   the freshly-pulled model as active so the next explain uses it.
  useEffect(() => {
    const prev = prevSetupPhaseRef.current
    const cur = setupProgress?.phase
    prevSetupPhaseRef.current = cur
    if (prev !== 'ready' && cur === 'ready') {
      setAddingModel(false)
      void (async () => {
        const next = await refreshStatus()
        if (next.available && next.models && next.models.length > 0) {
          const pickedModel = setupProgress?.model || next.models[0]
          setActiveModel(pickedModel)
          lastDiffRef.current = ''
        }
      })()
    }
  }, [setupProgress?.phase, setupProgress?.model, refreshStatus])

  const handleStartSetup = useCallback(async () => {
    const tier = TIERS.find((t) => t.id === selectedTier) ?? TIERS.find((t) => t.id === recommendedTier)
    const model = tier?.modelId
    setError(null)
    await startSetupFlow({ model })
    // The pull runs in the background; surface progress via the header chip
    // and the inline card. Closing the drawer keeps the screen uncluttered.
    onClose()
  }, [selectedTier, recommendedTier, startSetupFlow, onClose])

  const handleCancelSetup = useCallback(async () => {
    await cancelSetupFlow()
  }, [cancelSetupFlow])

  const handleInstall = useCallback(async () => {
    try {
      await openOllamaDownloadPage()
    } catch {
      /* noop */
    }
  }, [openOllamaDownloadPage])

  const handleRetryStatus = useCallback(() => {
    dismissSetupError()
    void refreshStatus()
  }, [dismissSetupError, refreshStatus])

  const handleLanguageChange = useCallback(
    (value: string | null) => {
      const next = value ?? 'English'
      setLanguage(next)
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
      } catch {
        /* noop */
      }
      lastDiffRef.current = ''
    },
    [],
  )

  const queueDeleteConfirm = useCallback((m: string | null) => {
    if (revertTimeoutRef.current !== null) {
      window.clearTimeout(revertTimeoutRef.current)
      revertTimeoutRef.current = null
    }
    setConfirmDeleteModel(m)
    if (m !== null) {
      revertTimeoutRef.current = window.setTimeout(() => {
        setConfirmDeleteModel(null)
        revertTimeoutRef.current = null
      }, 3000)
    }
  }, [])

  const handleDeleteClick = useCallback(
    async (m: string) => {
      if (confirmDeleteModel !== m) {
        queueDeleteConfirm(m)
        return
      }
      queueDeleteConfirm(null)
      setDeletingModel(m)
      try {
        await deleteOllamaModel({ model: m })
        const next = await refreshStatus()
        if (activeModel === m) {
          const fallback = next.models?.[0] ?? ''
          setActiveModel(fallback)
          lastDiffRef.current = ''
        }
      } catch (e) {
        setError(formatUnknownError(e))
      } finally {
        setDeletingModel(null)
      }
    },
    [confirmDeleteModel, queueDeleteConfirm, deleteOllamaModel, refreshStatus, activeModel],
  )

  const viewState: 'detecting' | 'ready-flash' | 'setup-progress' | 'setup-needed' | 'available' =
    !status
      ? 'detecting'
      : showReadyFlash
        ? 'ready-flash'
        : isSettingUp || setupProgress?.phase === 'error'
          ? 'setup-progress'
          : status.available
            ? 'available'
            : 'setup-needed'

  const effectiveTier =
    TIERS.find((t) => t.id === selectedTier) ?? TIERS.find((t) => t.id === recommendedTier)

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={480}
      title={
        <Group gap="xs" wrap="nowrap">
          <Text fw={600}>Explain diff</Text>
          {usedProvider ? (
            <Badge size="xs" variant="light" color="blue">
              {usedProvider}
            </Badge>
          ) : null}
          {usedModel ? (
            <Text size="xs" c="dimmed">
              {usedModel}
            </Text>
          ) : null}
        </Group>
      }
      padding="md"
    >
      <Stack gap="sm" style={{ height: '100%' }}>
        {viewState === 'detecting' ? (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Detecting provider…
            </Text>
          </Group>
        ) : null}

        {viewState === 'setup-needed' && status ? (
          status.ollamaInstalled ? (
            <Stack gap="sm">
              <Stack gap={4}>
                <Text fw={600}>Pick a model</Text>
                <Text size="xs" c="dimmed">
                  One-time setup. After this, generation runs on your machine.
                </Text>
              </Stack>
              <ContextBullets />
              <Stack gap="xs">
                {TIERS.map((tier) => (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    selected={selectedTier === tier.id}
                    recommended={recommendedTier === tier.id}
                    blocked={isTierBlocked(tier.id, status.hardwareTier)}
                    onClick={() => setSelectedTier(tier.id)}
                  />
                ))}
              </Stack>
              <Button
                size="sm"
                onClick={() => void handleStartSetup()}
                disabled={!effectiveTier}
              >
                {effectiveTier
                  ? `Set up ${effectiveTier.name} (${effectiveTier.size})`
                  : 'Set up'}
              </Button>
              <Text size="xs" c="dimmed">
                Want a different model later? Browse{' '}
                <Anchor href="https://ollama.com/library" target="_blank" rel="noreferrer">
                  ollama.com/library
                </Anchor>
                .
              </Text>
              {status.error ? (
                <Text size="xs" c="dimmed">
                  {status.error}
                </Text>
              ) : null}
            </Stack>
          ) : (
            <Stack gap="sm">
              <Stack gap={4}>
                <Text fw={600}>Set up local AI explanations</Text>
                <Text size="xs" c="dimmed">
                  Install Ollama once — then we handle the rest.
                </Text>
              </Stack>
              <ContextBullets />
              <Alert color="blue" variant="light" title="Install Ollama">
                <Stack gap="xs">
                  <Text size="sm">
                    Ollama is the local runtime that hosts the model.
                  </Text>
                  <Group gap="xs">
                    <Button size="xs" onClick={() => void handleInstall()}>
                      Open download page
                    </Button>
                    <Button size="xs" variant="default" onClick={handleRetryStatus}>
                      I have installed it
                    </Button>
                  </Group>
                </Stack>
              </Alert>
              {status.error ? (
                <Text size="xs" c="dimmed">
                  {status.error}
                </Text>
              ) : null}
            </Stack>
          )
        ) : null}

        {viewState === 'setup-progress' && setupProgress ? (
          <Stack gap={6}>
            <Group gap="xs" wrap="nowrap" justify="space-between">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                {setupProgress.phase === 'error' ? null : <Loader size="xs" />}
                <Text size="sm" fw={500}>
                  {describeSetupPhase(setupProgress.phase)}
                </Text>
                {setupProgress.model ? (
                  <Text size="xs" c="dimmed" ff="monospace">
                    {setupProgress.model}
                  </Text>
                ) : null}
              </Group>
              {isSettingUp && setupProgress.phase !== 'error' ? (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => void handleCancelSetup()}
                >
                  Cancel
                </Button>
              ) : null}
            </Group>
            {setupProgress.phase === 'pulling' && (setupProgress.pullTotal ?? 0) > 0 ? (
              <>
                <Progress value={setupProgress.pullPercent ?? 0} size="sm" animated />
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatBytes(setupProgress.pullCompleted ?? 0)} /{' '}
                    {formatBytes(setupProgress.pullTotal ?? 0)} —{' '}
                    {(setupProgress.pullPercent ?? 0).toFixed(0)}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    {etaMs && etaMs > 0 ? formatEta(etaMs) : 'Estimating…'}
                  </Text>
                </Group>
              </>
            ) : setupProgress.message && setupProgress.phase !== 'error' ? (
              <Text size="xs" c="dimmed">
                {setupProgress.message}
              </Text>
            ) : null}
            {setupProgress.phase === 'error' ? (
              <Alert color="red" variant="light" title="Setup failed">
                <Stack gap={6}>
                  <Text size="sm">{setupProgress.error}</Text>
                  <Group gap="xs">
                    <Button size="xs" onClick={() => void handleStartSetup()}>
                      Retry
                    </Button>
                    <Button size="xs" variant="default" onClick={handleRetryStatus}>
                      Re-check
                    </Button>
                  </Group>
                </Stack>
              </Alert>
            ) : null}
          </Stack>
        ) : null}

        {viewState === 'ready-flash' ? (
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="green" radius="xl">
              <IconCheck size={14} />
            </ThemeIcon>
            <Text size="sm" fw={500}>
              Ready
            </Text>
          </Group>
        ) : null}

        {viewState === 'available' && status?.available ? (
          <>
            <Group gap={6} wrap="nowrap" align="center">
              <Popover
                opened={modelMenuOpen}
                onChange={setModelMenuOpen}
                position="bottom-start"
                shadow="md"
                width={360}
                withinPortal
                trapFocus={false}
              >
                <Popover.Target>
                  <Button
                    variant="default"
                    size="xs"
                    fullWidth
                    rightSection={
                      <IconChevronDown size={12} style={{ opacity: 0.55 }} />
                    }
                    onClick={() => setModelMenuOpen((o) => !o)}
                    styles={{
                      root: { flex: 1, minWidth: 0, fontWeight: 400 },
                      inner: { justifyContent: 'space-between' },
                      label: {
                        fontFamily:
                          'var(--mantine-font-family-monospace, ui-monospace, monospace)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    }}
                  >
                    {activeModel || '—'}
                  </Button>
                </Popover.Target>
                <Popover.Dropdown p="xs">
                  <Stack gap="xs">
                    <Stack gap={2}>
                      {(status.models ?? []).map((m) => {
                        const isActive = m === activeModel
                        const isConfirming = confirmDeleteModel === m
                        const isDeleting = deletingModel === m
                        return (
                          <Group
                            key={m}
                            wrap="nowrap"
                            gap="xs"
                            style={{
                              padding: '4px 8px',
                              borderRadius: 6,
                              background: isActive
                                ? 'var(--mantine-color-default-hover)'
                                : 'transparent',
                              cursor: isActive ? 'default' : 'pointer',
                            }}
                            onClick={() => {
                              if (!isActive) {
                                setActiveModel(m)
                                setModelMenuOpen(false)
                              }
                            }}
                          >
                            <span
                              style={{
                                width: 12,
                                display: 'inline-flex',
                                justifyContent: 'center',
                                flex: 'none',
                              }}
                            >
                              {isActive ? (
                                <IconCheck
                                  size={12}
                                  style={{ color: 'var(--mantine-color-green-5)' }}
                                />
                              ) : null}
                            </span>
                            <Text
                              size="sm"
                              ff="monospace"
                              style={{
                                minWidth: 0,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {m}
                            </Text>
                            <Tooltip
                              label={
                                isConfirming ? 'Click again to confirm' : 'Delete'
                              }
                            >
                              <ActionIcon
                                size="sm"
                                variant={isConfirming ? 'filled' : 'subtle'}
                                color={isConfirming ? 'red' : 'gray'}
                                loading={isDeleting}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleDeleteClick(m)
                                }}
                                aria-label={
                                  isConfirming
                                    ? `Confirm delete ${m}`
                                    : `Delete ${m}`
                                }
                              >
                                <IconTrash size={13} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        )
                      })}
                    </Stack>

                    {addingModel ? (
                      <Stack gap="xs" style={{ paddingTop: 2 }}>
                        {availableTiers.length > 0 ? (
                          <>
                            {availableTiers.map((tier) => (
                              <TierCard
                                key={tier.id}
                                tier={tier}
                                selected={selectedTier === tier.id}
                                recommended={recommendedTier === tier.id}
                                blocked={isTierBlocked(
                                  tier.id,
                                  status.hardwareTier,
                                )}
                                onClick={() => setSelectedTier(tier.id)}
                              />
                            ))}
                            <Group gap="xs">
                              <Button
                                size="compact-sm"
                                onClick={() => void handleStartSetup()}
                                disabled={!effectiveTier}
                              >
                                {effectiveTier
                                  ? `Pull ${effectiveTier.name} (${effectiveTier.size})`
                                  : 'Pull'}
                              </Button>
                              <Button
                                size="compact-sm"
                                variant="default"
                                onClick={() => setAddingModel(false)}
                              >
                                Cancel
                              </Button>
                            </Group>
                          </>
                        ) : (
                          <>
                            <Text size="xs" c="dimmed">
                              All recommended tiers are installed. Browse{' '}
                              <Anchor
                                href="https://ollama.com/library"
                                target="_blank"
                                rel="noreferrer"
                              >
                                ollama.com/library
                              </Anchor>{' '}
                              for more.
                            </Text>
                            <Group gap="xs">
                              <Button
                                size="compact-sm"
                                variant="default"
                                onClick={() => setAddingModel(false)}
                              >
                                Cancel
                              </Button>
                            </Group>
                          </>
                        )}
                      </Stack>
                    ) : (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="gray"
                        leftSection={<IconPlus size={12} />}
                        onClick={() => setAddingModel(true)}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        Add model
                      </Button>
                    )}
                  </Stack>
                </Popover.Dropdown>
              </Popover>

              <Select
                size="xs"
                value={language}
                onChange={handleLanguageChange}
                data={LANGUAGE_OPTIONS}
                style={{ width: 110, flex: 'none' }}
                comboboxProps={{ withinPortal: true }}
                allowDeselect={false}
                aria-label="Response language"
              />

              <Tooltip label="Regenerate">
                <ActionIcon
                  variant="default"
                  size={30}
                  onClick={() => void runExplain()}
                  disabled={isLoading || !diffText.trim()}
                  aria-label="Regenerate"
                >
                  <IconRefresh size={15} />
                </ActionIcon>
              </Tooltip>
            </Group>

            {!diffText.trim() ? (
              <Text size="sm" c="dimmed">
                Run a comparison first — there is no diff to explain yet.
              </Text>
            ) : null}

            {isLoading && !explanation ? (
              <Stack gap={6}>
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text size="sm" c="dimmed">
                    {thinking ? 'Thinking…' : 'Generating explanation…'}
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
              <Alert color="red" variant="light" title="Failed to explain diff">
                <Text size="sm">{error}</Text>
              </Alert>
            ) : null}

            {explanation ? (
              <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
                <ExplanationMarkdown
                  content={isLoading ? explanation + ' ▋' : explanation}
                />
              </ScrollArea>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Drawer>
  )
}
