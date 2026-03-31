import { useCallback, useMemo, useState } from 'react'
import YAML from 'yaml'
import { notifications } from '@mantine/notifications'
import { upsertRecentPair } from '../../persistence'
import type {
  CompareCommon,
  CompareResponse,
  CompareSpecRichResponse,
  CompareSpecValuesRequest,
  DesktopRecentPair,
  LoadTextFileRequest,
  LoadTextFileResponse,
} from '../../types'
import {
  formatUnknownError,
  getRuntimeClipboardRead,
  getRuntimeClipboardWrite,
  ignorePathsToText,
  parseIgnorePaths,
  renderResult,
} from '../../utils/appHelpers'

export type SpecTextInputTarget = 'old' | 'new'

type CompareSpecValuesRichFn = (
  req: CompareSpecValuesRequest,
) => Promise<CompareSpecRichResponse>

type PickSpecFileFn = () => Promise<string>
type LoadTextFileFn = (req: LoadTextFileRequest) => Promise<LoadTextFileResponse>

type UseSpecCompareWorkflowOptions = {
  initialCommon: CompareCommon
  getCompareSpecValuesRich: () => CompareSpecValuesRichFn | undefined
  getPickSpecFile: () => PickSpecFileFn | undefined
  getLoadTextFile: () => LoadTextFileFn | undefined
  onSpecCompareCompleted?: (res: CompareResponse) => void
}

type RunSpecCompareWithValuesOptions = {
  oldText: string
  newText: string
  oldSourcePath?: string
  newSourcePath?: string
}

type RunSpecCompareFromPathsOptions = {
  oldPath: string
  newPath: string
}

function detectSpecInputLanguage(sourcePath: string, value: string): 'json' | 'yaml' {
  const lowerPath = sourcePath.toLowerCase()
  if (lowerPath.endsWith('.json')) {
    return 'json'
  }
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) {
    return 'yaml'
  }

  const trimmed = value.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json'
  }
  return 'yaml'
}

function getSpecParseError(input: string, language: 'json' | 'yaml'): string | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  try {
    if (language === 'json') {
      JSON.parse(trimmed)
    } else {
      YAML.parse(trimmed)
    }
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export function useSpecCompareWorkflow({
  initialCommon,
  getCompareSpecValuesRich,
  getPickSpecFile,
  getLoadTextFile,
  onSpecCompareCompleted,
}: UseSpecCompareWorkflowOptions) {
  const [specOldText, setSpecOldText] = useState('')
  const [specNewText, setSpecNewText] = useState('')
  const [specOldSourcePath, setSpecOldSourcePath] = useState('')
  const [specNewSourcePath, setSpecNewSourcePath] = useState('')
  const [specCommon, setSpecCommon] = useState<CompareCommon>(initialCommon)
  const [specRichResult, setSpecRichResult] = useState<CompareSpecRichResponse | null>(null)
  const [specClipboardBusyTarget, setSpecClipboardBusyTarget] =
    useState<SpecTextInputTarget | null>(null)
  const [specFileBusyTarget, setSpecFileBusyTarget] =
    useState<SpecTextInputTarget | null>(null)
  const [specCopyBusyTarget, setSpecCopyBusyTarget] =
    useState<SpecTextInputTarget | null>(null)
  const [specCopyBusy, setSpecCopyBusy] = useState(false)
  const [specIgnorePathsDraft, setSpecIgnorePathsDraft] = useState(() =>
    ignorePathsToText(initialCommon.ignorePaths),
  )
  const [specRecentPairs, setSpecRecentPairs] = useState<DesktopRecentPair[]>([])

  const effectiveSpecIgnorePaths = useMemo(
    () => parseIgnorePaths(specIgnorePathsDraft),
    [specIgnorePathsDraft],
  )
  const specOldLanguage = useMemo(
    () => detectSpecInputLanguage(specOldSourcePath, specOldText),
    [specOldSourcePath, specOldText],
  )
  const specNewLanguage = useMemo(
    () => detectSpecInputLanguage(specNewSourcePath, specNewText),
    [specNewSourcePath, specNewText],
  )
  const specOldParseError = useMemo(
    () => getSpecParseError(specOldText, specOldLanguage),
    [specOldLanguage, specOldText],
  )
  const specNewParseError = useMemo(
    () => getSpecParseError(specNewText, specNewLanguage),
    [specNewLanguage, specNewText],
  )
  const specInputInvalid = !!specOldParseError || !!specNewParseError
  const specInputEmpty = !specOldText.trim() || !specNewText.trim()
  const specEditorBusy = specClipboardBusyTarget !== null || specFileBusyTarget !== null

  const nowISO = () => new Date().toISOString()

  const updateSpecCommon = useCallback(
    <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
      setSpecCommon((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const setSpecOldInput = useCallback((value: string) => {
    setSpecOldText(value)
    setSpecOldSourcePath('')
  }, [])

  const setSpecNewInput = useCallback((value: string) => {
    setSpecNewText(value)
    setSpecNewSourcePath('')
  }, [])

  const buildSafeSpecCommon = useCallback(
    () => ({
      ...specCommon,
      ignorePaths: effectiveSpecIgnorePaths,
      textStyle: specCommon.textStyle === 'patch' ? 'semantic' : specCommon.textStyle,
    }),
    [effectiveSpecIgnorePaths, specCommon],
  )

  const applyComparedSpecPair = useCallback(
    (
      params: RunSpecCompareWithValuesOptions & {
        richResult: CompareSpecRichResponse
      },
    ) => {
      const {
        oldText: nextOldText,
        newText: nextNewText,
        oldSourcePath = '',
        newSourcePath = '',
        richResult,
      } = params

      setSpecOldText(nextOldText)
      setSpecNewText(nextNewText)
      setSpecOldSourcePath(oldSourcePath)
      setSpecNewSourcePath(newSourcePath)
      setSpecRichResult(richResult)
      onSpecCompareCompleted?.(richResult.result)

      if (oldSourcePath.trim() && newSourcePath.trim()) {
        setSpecRecentPairs((prev) =>
          upsertRecentPair(prev, {
            oldPath: oldSourcePath,
            newPath: newSourcePath,
            usedAt: nowISO(),
          }),
        )
      }
    },
    [onSpecCompareCompleted],
  )

  const runSpecCompareWithValues = useCallback(
    async ({
      oldText: nextOldText,
      newText: nextNewText,
      oldSourcePath = '',
      newSourcePath = '',
    }: RunSpecCompareWithValuesOptions) => {
      const compareSpecValuesRich = getCompareSpecValuesRich()
      if (!compareSpecValuesRich) {
        throw new Error('Wails bridge not available (CompareSpecValuesRich)')
      }

      const richResult = await compareSpecValuesRich({
        oldValue: nextOldText,
        newValue: nextNewText,
        common: buildSafeSpecCommon(),
      } satisfies CompareSpecValuesRequest)

      applyComparedSpecPair({
        oldText: nextOldText,
        newText: nextNewText,
        oldSourcePath,
        newSourcePath,
        richResult,
      })

      return richResult
    },
    [applyComparedSpecPair, buildSafeSpecCommon, getCompareSpecValuesRich],
  )

  const runSpecCompareFromPaths = useCallback(
    async ({ oldPath, newPath }: RunSpecCompareFromPathsOptions) => {
      const loadTextFile = getLoadTextFile()
      if (!loadTextFile) {
        throw new Error('Wails bridge not available (LoadTextFile)')
      }

      const [oldLoaded, newLoaded] = await Promise.all([
        loadTextFile({ path: oldPath } satisfies LoadTextFileRequest),
        loadTextFile({ path: newPath } satisfies LoadTextFileRequest),
      ])

      return runSpecCompareWithValues({
        oldText: oldLoaded.content,
        newText: newLoaded.content,
        oldSourcePath: oldLoaded.path,
        newSourcePath: newLoaded.path,
      })
    },
    [getLoadTextFile, runSpecCompareWithValues],
  )

  const runSpec = useCallback(
    async () =>
      runSpecCompareWithValues({
        oldText: specOldText,
        newText: specNewText,
        oldSourcePath: specOldSourcePath,
        newSourcePath: specNewSourcePath,
      }),
    [runSpecCompareWithValues, specNewSourcePath, specNewText, specOldSourcePath, specOldText],
  )

  const runSpecFromRecent = useCallback(
    async (pair: DesktopRecentPair) =>
      runSpecCompareFromPaths({
        oldPath: pair.oldPath,
        newPath: pair.newPath,
      }),
    [runSpecCompareFromPaths],
  )

  const pasteSpecFromClipboard = useCallback(async (target: SpecTextInputTarget) => {
    const readClipboard = getRuntimeClipboardRead()
    if (!readClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    setSpecClipboardBusyTarget(target)
    try {
      const pasted = await readClipboard()
      if (!pasted) {
        notifications.show({
          title: 'Clipboard is empty',
          message: 'Nothing to paste.',
          color: 'yellow',
        })
        return
      }

      if (target === 'old') {
        setSpecOldText(pasted)
        setSpecOldSourcePath('')
      } else {
        setSpecNewText(pasted)
        setSpecNewSourcePath('')
      }
    } catch (error) {
      notifications.show({
        title: 'Failed to paste from clipboard',
        message: `Failed to read clipboard: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setSpecClipboardBusyTarget(null)
    }
  }, [])

  const loadSpecFromFile = useCallback(
    async (target: SpecTextInputTarget) => {
      const pickSpecFile = getPickSpecFile()
      const loadTextFile = getLoadTextFile()
      if (!pickSpecFile || !loadTextFile) {
        notifications.show({
          title: 'Spec loader unavailable',
          message: 'Spec file loader is not available.',
          color: 'red',
        })
        return
      }

      setSpecFileBusyTarget(target)
      try {
        const selected = await pickSpecFile()
        if (!selected) {
          return
        }

        const loaded = await loadTextFile({
          path: selected,
        } satisfies LoadTextFileRequest)

        if (target === 'old') {
          setSpecOldText(loaded.content)
          setSpecOldSourcePath(loaded.path)
        } else {
          setSpecNewText(loaded.content)
          setSpecNewSourcePath(loaded.path)
        }
      } catch (error) {
        notifications.show({
          title: 'Failed to load spec file',
          message: `Failed to load spec file: ${formatUnknownError(error)}`,
          color: 'red',
        })
      } finally {
        setSpecFileBusyTarget(null)
      }
    },
    [getLoadTextFile, getPickSpecFile],
  )

  const copySpecInput = useCallback(
    async (target: SpecTextInputTarget) => {
      const writeClipboard = getRuntimeClipboardWrite()
      if (!writeClipboard) {
        notifications.show({
          title: 'Clipboard unavailable',
          message: 'Clipboard runtime is not available.',
          color: 'red',
        })
        return
      }

      const value = target === 'old' ? specOldText : specNewText
      if (!value) {
        return
      }

      setSpecCopyBusyTarget(target)
      try {
        const ok = await writeClipboard(value)
        if (!ok) {
          notifications.show({
            title: 'Copy failed',
            message: `Failed to copy ${target === 'old' ? 'Old' : 'New'} spec.`,
            color: 'red',
          })
          return
        }

        notifications.show({
          title: 'Copied',
          message: `${target === 'old' ? 'Old' : 'New'} spec copied to clipboard.`,
          color: 'green',
        })
      } catch (error) {
        notifications.show({
          title: 'Copy failed',
          message: `Failed to copy spec: ${formatUnknownError(error)}`,
          color: 'red',
        })
      } finally {
        setSpecCopyBusyTarget(null)
      }
    },
    [specNewText, specOldText],
  )

  const clearSpecInput = useCallback((target: SpecTextInputTarget) => {
    if (target === 'old') {
      setSpecOldText('')
      setSpecOldSourcePath('')
      return
    }

    setSpecNewText('')
    setSpecNewSourcePath('')
  }, [])

  const copySpecResultRawOutput = useCallback(async () => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    const raw = specRichResult ? renderResult(specRichResult.result) : ''
    if (!raw) {
      return
    }

    setSpecCopyBusy(true)
    try {
      const ok = await writeClipboard(raw)
      if (!ok) {
        notifications.show({
          title: 'Copy failed',
          message: 'Failed to copy raw output.',
          color: 'red',
        })
        return
      }

      notifications.show({
        title: 'Copied',
        message: 'Raw output copied to clipboard.',
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Copy failed',
        message: `Failed to copy raw output: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setSpecCopyBusy(false)
    }
  }, [specRichResult])

  return {
    specOldText,
    setSpecOldText,
    setSpecOldInput,
    specNewText,
    setSpecNewText,
    setSpecNewInput,
    specOldSourcePath,
    setSpecOldSourcePath,
    specNewSourcePath,
    setSpecNewSourcePath,
    specCommon,
    setSpecCommon,
    updateSpecCommon,
    specRichResult,
    setSpecRichResult,
    specClipboardBusyTarget,
    specFileBusyTarget,
    specCopyBusyTarget,
    specCopyBusy,
    specIgnorePathsDraft,
    setSpecIgnorePathsDraft,
    specRecentPairs,
    setSpecRecentPairs,
    effectiveSpecIgnorePaths,
    specOldLanguage,
    specNewLanguage,
    specOldParseError,
    specNewParseError,
    specInputInvalid,
    specInputEmpty,
    specEditorBusy,
    runSpec,
    runSpecFromRecent,
    runSpecCompareFromPaths,
    runSpecCompareWithValues,
    pasteSpecFromClipboard,
    loadSpecFromFile,
    copySpecInput,
    clearSpecInput,
    copySpecResultRawOutput,
  }
}
