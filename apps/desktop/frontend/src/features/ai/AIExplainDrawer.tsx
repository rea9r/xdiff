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
  IconLock,
  IconRefresh,
  IconWallet,
} from '@tabler/icons-react'
import { useDesktopBridge } from '../../useDesktopBridge'
import type {
  AIProviderStatus,
  AISetupPhase,
  AISetupProgress,
  ExplainDiffMode,
  HardwareTier,
} from '../../types'
import { formatUnknownError } from '../../utils/appHelpers'

export type AIExplainDrawerProps = {
  opened: boolean
  onClose: () => void
  diffText: string
  mode: ExplainDiffMode
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
    modelId: 'qwen3.5:0.8b',
    size: '~1.0 GB',
    description: 'Fastest. Runs on any laptop.',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    modelId: 'qwen3.5:4b',
    size: '~3.4 GB',
    description: 'Best for most laptops.',
  },
  {
    id: 'high',
    name: 'High Quality',
    modelId: 'qwen3.5:9b',
    size: '~6.6 GB',
    description: 'Best output. Needs more RAM.',
  },
]

const POLL_INTERVAL_MS = 500
const ETA_MIN_SAMPLES = 5
const ETA_MAX_SAMPLES = 10
const READY_FLASH_MS = 900

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

export function AIExplainDrawer({ opened, onClose, diffText, mode }: AIExplainDrawerProps) {
  const {
    aiProviderStatus,
    explainDiff,
    startAISetup,
    aiSetupProgress,
    cancelAISetup,
    openOllamaDownloadPage,
  } = useDesktopBridge()

  const [status, setStatus] = useState<AIProviderStatus | null>(null)
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeModel, setActiveModel] = useState<string>('')
  const [usedProvider, setUsedProvider] = useState<string | null>(null)
  const [usedModel, setUsedModel] = useState<string | null>(null)
  const [setupProgress, setSetupProgress] = useState<AISetupProgress | null>(null)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null)
  const [showReadyFlash, setShowReadyFlash] = useState(false)
  const [etaMs, setEtaMs] = useState<number | null>(null)

  const lastDiffRef = useRef<string>('')
  const samplesRef = useRef<{ t: number; bytes: number }[]>([])
  const prevPhaseRef = useRef<AISetupPhase | undefined>(undefined)

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
      setIsLoading(true)
      setError(null)
      setExplanation('')
      try {
        const res = await explainDiff({
          diffText,
          mode,
          model: modelOverride ?? activeModel,
        })
        if (res.error) {
          setError(res.error)
        } else {
          setExplanation(res.explanation)
        }
        if (res.provider) setUsedProvider(res.provider)
        if (res.model) setUsedModel(res.model)
      } catch (e) {
        setError(formatUnknownError(e))
      } finally {
        setIsLoading(false)
      }
    },
    [activeModel, diffText, explainDiff, mode],
  )

  // Re-detect provider every time the drawer opens — state outside the app
  // (Ollama install, daemon start) may have changed since last open.
  useEffect(() => {
    if (!opened) return
    void refreshStatus()
  }, [opened, refreshStatus])

  // Default selected tier follows hardware tier (low → compact, else balanced).
  const recommendedTier = useMemo(
    () => pickRecommendedTier(status?.hardwareTier),
    [status?.hardwareTier],
  )
  useEffect(() => {
    if (selectedTier) return
    if (!status) return
    setSelectedTier(recommendedTier)
  }, [status, selectedTier, recommendedTier])

  // First-model autopick when status reports availability but we haven't picked one yet.
  useEffect(() => {
    if (!status?.available) return
    if (activeModel) return
    if (status.models && status.models.length > 0) {
      setActiveModel(status.models[0])
    }
  }, [status, activeModel])

  // Auto-explain when a usable provider/model is in place and the diff changed.
  useEffect(() => {
    if (!opened) return
    if (showReadyFlash) return
    if (!status?.available) return
    if (!diffText.trim()) return
    if (lastDiffRef.current === diffText && explanation) return
    lastDiffRef.current = diffText
    void runExplain()
  }, [opened, status?.available, diffText, explanation, runExplain, showReadyFlash])

  // Poll setup progress while a setup run is in flight.
  useEffect(() => {
    if (!isSettingUp) return
    let cancelled = false
    const tick = async () => {
      try {
        const p = await aiSetupProgress()
        if (cancelled) return
        setSetupProgress(p)
        if (p.phase === 'ready') {
          setIsSettingUp(false)
          const next = await refreshStatus()
          if (next.available && next.models && next.models.length > 0) {
            const pickedModel = p.model || next.models[0]
            setActiveModel(pickedModel)
            lastDiffRef.current = ''
          }
        } else if (p.phase === 'error') {
          setIsSettingUp(false)
        }
      } catch (e) {
        if (cancelled) return
        setIsSettingUp(false)
        setSetupProgress({ phase: 'error', error: formatUnknownError(e) })
      }
    }
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [isSettingUp, aiSetupProgress, refreshStatus])

  // ETA: rolling window of (timestamp, completed-bytes) samples while pulling.
  useEffect(() => {
    if (!setupProgress || setupProgress.phase !== 'pulling') {
      samplesRef.current = []
      setEtaMs(null)
      return
    }
    const completed = setupProgress.pullCompleted ?? 0
    const total = setupProgress.pullTotal ?? 0
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
  }, [setupProgress])

  // Brief "Ready" flash when phase transitions into ready, then clear.
  useEffect(() => {
    const prev = prevPhaseRef.current
    const cur = setupProgress?.phase
    prevPhaseRef.current = cur
    if (prev !== 'ready' && cur === 'ready') {
      setShowReadyFlash(true)
      const id = window.setTimeout(() => {
        setShowReadyFlash(false)
        setSetupProgress(null)
      }, READY_FLASH_MS)
      return () => window.clearTimeout(id)
    }
  }, [setupProgress?.phase])

  const handleStartSetup = useCallback(async () => {
    const tier = TIERS.find((t) => t.id === selectedTier) ?? TIERS.find((t) => t.id === recommendedTier)
    const model = tier?.modelId
    setError(null)
    setSetupProgress({ phase: 'starting', message: 'Preparing local AI', model })
    samplesRef.current = []
    setEtaMs(null)
    setIsSettingUp(true)
    try {
      await startAISetup({ model })
    } catch (e) {
      setIsSettingUp(false)
      setSetupProgress({ phase: 'error', error: formatUnknownError(e) })
    }
  }, [selectedTier, recommendedTier, startAISetup])

  const handleCancelSetup = useCallback(async () => {
    try {
      await cancelAISetup()
    } catch {
      /* noop */
    }
    setIsSettingUp(false)
    setSetupProgress(null)
    samplesRef.current = []
    setEtaMs(null)
  }, [cancelAISetup])

  const handleInstall = useCallback(async () => {
    try {
      await openOllamaDownloadPage()
    } catch {
      /* noop */
    }
  }, [openOllamaDownloadPage])

  const handleRetryStatus = useCallback(() => {
    setSetupProgress(null)
    void refreshStatus()
  }, [refreshStatus])

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
            {status.models && status.models.length > 0 ? (
              <Group gap="xs" align="end" wrap="nowrap">
                <Select
                  label="Model"
                  size="xs"
                  value={activeModel}
                  onChange={(value) => setActiveModel(value ?? '')}
                  data={status.models}
                  style={{ flex: 1 }}
                  comboboxProps={{ withinPortal: true }}
                  allowDeselect={false}
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
            ) : null}

            {!diffText.trim() ? (
              <Text size="sm" c="dimmed">
                Run a comparison first — there is no diff to explain yet.
              </Text>
            ) : null}

            {isLoading ? (
              <Group gap="xs">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">
                  Generating explanation…
                </Text>
              </Group>
            ) : null}

            {error ? (
              <Alert color="red" variant="light" title="Failed to explain diff">
                <Text size="sm">{error}</Text>
              </Alert>
            ) : null}

            {explanation ? (
              <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
                <Text
                  size="sm"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {explanation}
                </Text>
              </ScrollArea>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Drawer>
  )
}
