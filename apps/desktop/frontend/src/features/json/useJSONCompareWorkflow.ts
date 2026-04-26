import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { upsertRecentPair } from '../../persistence'
import type {
  CompareCommon,
  CompareJSONRichResponse,
  CompareJSONValuesRequest,
  CompareResponse,
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
import {
  showClipboardEmptyNotification,
  showClipboardUnavailableNotification,
  showErrorNotification,
  showSuccessNotification,
} from '../../utils/notifications'

export type JSONTextInputTarget = 'old' | 'new'

type CompareJSONValuesRichFn = (
  req: CompareJSONValuesRequest,
) => Promise<CompareJSONRichResponse>

type PickJSONFileFn = () => Promise<string>
type LoadTextFileFn = (req: LoadTextFileRequest) => Promise<LoadTextFileResponse>

export type UseJSONCompareWorkflowOptions = {
  initialCommon: CompareCommon
  initialIgnoreOrder?: boolean
  getCompareJSONValuesRich: () => CompareJSONValuesRichFn | undefined
  getPickJSONFile: () => PickJSONFileFn | undefined
  getLoadTextFile: () => LoadTextFileFn | undefined
  onJSONCompareCompleted?: (res: CompareResponse) => void
  setJSONRecentPairs: Dispatch<SetStateAction<DesktopRecentPair[]>>
}

type RunJSONCompareWithValuesOptions = {
  oldText: string
  newText: string
  oldSourcePath?: string
  newSourcePath?: string
}

type RunJSONCompareFromPathsOptions = {
  oldPath: string
  newPath: string
}

function getJSONParseError(input: string): string | null {
  if (!input.trim()) {
    return null
  }

  try {
    JSON.parse(input)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export function useJSONCompareWorkflow({
  initialCommon,
  initialIgnoreOrder = false,
  getCompareJSONValuesRich,
  getPickJSONFile,
  getLoadTextFile,
  onJSONCompareCompleted,
  setJSONRecentPairs,
}: UseJSONCompareWorkflowOptions) {
  const [jsonOldText, setJSONOldText] = useState('')
  const [jsonNewText, setJSONNewText] = useState('')
  const [jsonOldSourcePath, setJSONOldSourcePath] = useState('')
  const [jsonNewSourcePath, setJSONNewSourcePath] = useState('')
  const [ignoreOrder, setIgnoreOrder] = useState(initialIgnoreOrder)
  const [jsonCommon, setJSONCommon] = useState<CompareCommon>(initialCommon)
  const [jsonRichResult, setJSONRichResult] = useState<CompareJSONRichResponse | null>(null)
  const [jsonCopyBusy, setJSONCopyBusy] = useState(false)
  const [jsonClipboardBusyTarget, setJSONClipboardBusyTarget] =
    useState<JSONTextInputTarget | null>(null)
  const [jsonFileBusyTarget, setJSONFileBusyTarget] =
    useState<JSONTextInputTarget | null>(null)
  const [jsonCopyBusyTarget, setJSONCopyBusyTarget] =
    useState<JSONTextInputTarget | null>(null)
  const [jsonIgnorePathsDraft, setJSONIgnorePathsDraft] = useState(() =>
    ignorePathsToText(initialCommon.ignorePaths),
  )

  const effectiveJSONIgnorePaths = useMemo(
    () => parseIgnorePaths(jsonIgnorePathsDraft),
    [jsonIgnorePathsDraft],
  )
  const jsonPatchBlockedByFilters =
    ignoreOrder || effectiveJSONIgnorePaths.length > 0
  const jsonOldParseError = useMemo(() => getJSONParseError(jsonOldText), [jsonOldText])
  const jsonNewParseError = useMemo(() => getJSONParseError(jsonNewText), [jsonNewText])
  const jsonInputInvalid = !!jsonOldParseError || !!jsonNewParseError
  const jsonInputEmpty = !jsonOldText.trim() || !jsonNewText.trim()
  const jsonEditorBusy = jsonClipboardBusyTarget !== null || jsonFileBusyTarget !== null

  useEffect(() => {
    if (jsonCommon.textStyle !== 'patch') {
      return
    }
    if (!jsonPatchBlockedByFilters) {
      return
    }
    setJSONCommon((prev) => ({ ...prev, textStyle: 'semantic' }))
  }, [jsonCommon.textStyle, jsonPatchBlockedByFilters])

  const nowISO = () => new Date().toISOString()

  const updateJSONCommon = useCallback(
    <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
      setJSONCommon((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const setJSONOldInput = useCallback((value: string) => {
    setJSONOldText(value)
    setJSONOldSourcePath('')
  }, [])

  const setJSONNewInput = useCallback((value: string) => {
    setJSONNewText(value)
    setJSONNewSourcePath('')
  }, [])

  const buildSafeJSONCommon = useCallback(
    () => ({
      ...jsonCommon,
      ignorePaths: effectiveJSONIgnorePaths,
      textStyle:
        jsonCommon.textStyle === 'patch' && jsonPatchBlockedByFilters
          ? 'semantic'
          : jsonCommon.textStyle,
    }),
    [effectiveJSONIgnorePaths, jsonCommon, jsonPatchBlockedByFilters],
  )

  const applyComparedJSONPair = useCallback(
    (
      params: RunJSONCompareWithValuesOptions & {
        richResult: CompareJSONRichResponse
      },
    ) => {
      const {
        oldText: nextOldText,
        newText: nextNewText,
        oldSourcePath = '',
        newSourcePath = '',
        richResult,
      } = params

      setJSONOldText(nextOldText)
      setJSONNewText(nextNewText)
      setJSONOldSourcePath(oldSourcePath)
      setJSONNewSourcePath(newSourcePath)
      setJSONRichResult(richResult)
      onJSONCompareCompleted?.(richResult.result)

      if (oldSourcePath.trim() && newSourcePath.trim()) {
        setJSONRecentPairs((prev) =>
          upsertRecentPair(prev, {
            oldPath: oldSourcePath,
            newPath: newSourcePath,
            usedAt: nowISO(),
          }),
        )
      }
    },
    [onJSONCompareCompleted, setJSONRecentPairs],
  )

  const runJSONCompareWithValues = useCallback(
    async ({
      oldText: nextOldText,
      newText: nextNewText,
      oldSourcePath = '',
      newSourcePath = '',
    }: RunJSONCompareWithValuesOptions) => {
      const compareJSONValuesRich = getCompareJSONValuesRich()
      if (!compareJSONValuesRich) {
        throw new Error('Wails bridge not available (CompareJSONValuesRich)')
      }

      const richResult = await compareJSONValuesRich({
        oldValue: nextOldText,
        newValue: nextNewText,
        common: buildSafeJSONCommon(),
        ignoreOrder,
      } satisfies CompareJSONValuesRequest)

      applyComparedJSONPair({
        oldText: nextOldText,
        newText: nextNewText,
        oldSourcePath,
        newSourcePath,
        richResult,
      })

      return richResult
    },
    [applyComparedJSONPair, buildSafeJSONCommon, getCompareJSONValuesRich, ignoreOrder],
  )

  const runJSONCompareFromPaths = useCallback(
    async ({ oldPath, newPath }: RunJSONCompareFromPathsOptions) => {
      const loadTextFile = getLoadTextFile()
      if (!loadTextFile) {
        throw new Error('Wails bridge not available (LoadTextFile)')
      }

      const [oldLoaded, newLoaded] = await Promise.all([
        loadTextFile({ path: oldPath } satisfies LoadTextFileRequest),
        loadTextFile({ path: newPath } satisfies LoadTextFileRequest),
      ])

      return runJSONCompareWithValues({
        oldText: oldLoaded.content,
        newText: newLoaded.content,
        oldSourcePath: oldLoaded.path,
        newSourcePath: newLoaded.path,
      })
    },
    [getLoadTextFile, runJSONCompareWithValues],
  )

  const runJSON = useCallback(
    async () =>
      runJSONCompareWithValues({
        oldText: jsonOldText,
        newText: jsonNewText,
        oldSourcePath: jsonOldSourcePath,
        newSourcePath: jsonNewSourcePath,
      }),
    [jsonNewSourcePath, jsonNewText, jsonOldSourcePath, jsonOldText, runJSONCompareWithValues],
  )

  const runJSONFromRecent = useCallback(
    async (pair: DesktopRecentPair) =>
      runJSONCompareFromPaths({
        oldPath: pair.oldPath,
        newPath: pair.newPath,
      }),
    [runJSONCompareFromPaths],
  )

  const pasteJSONFromClipboard = useCallback(async (target: JSONTextInputTarget) => {
    const readClipboard = getRuntimeClipboardRead()
    if (!readClipboard) {
      showClipboardUnavailableNotification()
      return
    }

    setJSONClipboardBusyTarget(target)

    try {
      const pasted = await readClipboard()
      if (!pasted) {
        showClipboardEmptyNotification()
        return
      }

      if (target === 'old') {
        setJSONOldText(pasted)
        setJSONOldSourcePath('')
      } else {
        setJSONNewText(pasted)
        setJSONNewSourcePath('')
      }
    } catch (error) {
      showErrorNotification(
        'Failed to paste from clipboard',
        `Failed to read clipboard: ${formatUnknownError(error)}`,
      )
    } finally {
      setJSONClipboardBusyTarget(null)
    }
  }, [])

  const loadJSONFromPath = useCallback(
    async (target: JSONTextInputTarget, path: string) => {
      const loadTextFile = getLoadTextFile()
      if (!loadTextFile) {
        showErrorNotification('JSON loader unavailable', 'JSON file loader is not available.')
        return
      }

      setJSONFileBusyTarget(target)

      try {
        const loaded = await loadTextFile({ path } satisfies LoadTextFileRequest)

        if (target === 'old') {
          setJSONOldText(loaded.content)
          setJSONOldSourcePath(loaded.path)
        } else {
          setJSONNewText(loaded.content)
          setJSONNewSourcePath(loaded.path)
        }
      } catch (error) {
        showErrorNotification(
          'Failed to load JSON file',
          `Failed to load JSON file: ${formatUnknownError(error)}`,
        )
      } finally {
        setJSONFileBusyTarget(null)
      }
    },
    [getLoadTextFile],
  )

  const loadJSONFromFile = useCallback(
    async (target: JSONTextInputTarget) => {
      const pickJSONFile = getPickJSONFile()
      if (!pickJSONFile) {
        showErrorNotification('JSON loader unavailable', 'JSON file loader is not available.')
        return
      }

      const selected = await pickJSONFile()
      if (!selected) {
        return
      }

      await loadJSONFromPath(target, selected)
    },
    [getPickJSONFile, loadJSONFromPath],
  )

  const copyJSONInput = useCallback(
    async (target: JSONTextInputTarget) => {
      const writeClipboard = getRuntimeClipboardWrite()
      if (!writeClipboard) {
        showClipboardUnavailableNotification()
        return
      }

      const value = target === 'old' ? jsonOldText : jsonNewText
      if (!value) {
        return
      }

      setJSONCopyBusyTarget(target)
      try {
        const ok = await writeClipboard(value)
        if (!ok) {
          showErrorNotification(
            'Copy failed',
            `Failed to copy ${target === 'old' ? 'Old' : 'New'} JSON.`,
          )
          return
        }

        showSuccessNotification(
          'Copied',
          `${target === 'old' ? 'Old' : 'New'} JSON copied to clipboard.`,
        )
      } catch (error) {
        showErrorNotification('Copy failed', `Failed to copy JSON: ${formatUnknownError(error)}`)
      } finally {
        setJSONCopyBusyTarget(null)
      }
    },
    [jsonNewText, jsonOldText],
  )

  const clearJSONInput = useCallback((target: JSONTextInputTarget) => {
    if (target === 'old') {
      setJSONOldText('')
      setJSONOldSourcePath('')
      return
    }

    setJSONNewText('')
    setJSONNewSourcePath('')
  }, [])

  const copyJSONResultRawOutput = useCallback(async () => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      showClipboardUnavailableNotification()
      return
    }

    const raw = jsonRichResult ? renderResult(jsonRichResult.result) : ''
    if (!raw) {
      return
    }

    setJSONCopyBusy(true)

    try {
      const ok = await writeClipboard(raw)
      if (!ok) {
        showErrorNotification('Copy failed', 'Failed to copy raw output.')
        return
      }

      showSuccessNotification('Copied', 'Raw output copied to clipboard.')
    } catch (error) {
      showErrorNotification(
        'Copy failed',
        `Failed to copy raw output: ${formatUnknownError(error)}`,
      )
    } finally {
      setJSONCopyBusy(false)
    }
  }, [jsonRichResult])

  return {
    jsonOldText,
    setJSONOldText,
    setJSONOldInput,
    jsonNewText,
    setJSONNewText,
    setJSONNewInput,
    jsonOldSourcePath,
    setJSONOldSourcePath,
    jsonNewSourcePath,
    setJSONNewSourcePath,
    ignoreOrder,
    setIgnoreOrder,
    jsonCommon,
    setJSONCommon,
    updateJSONCommon,
    jsonRichResult,
    setJSONRichResult,
    jsonCopyBusy,
    jsonClipboardBusyTarget,
    jsonFileBusyTarget,
    jsonCopyBusyTarget,
    jsonIgnorePathsDraft,
    setJSONIgnorePathsDraft,
    effectiveJSONIgnorePaths,
    jsonPatchBlockedByFilters,
    jsonOldParseError,
    jsonNewParseError,
    jsonInputInvalid,
    jsonInputEmpty,
    jsonEditorBusy,
    runJSON,
    runJSONFromRecent,
    runJSONCompareFromPaths,
    runJSONCompareWithValues,
    pasteJSONFromClipboard,
    loadJSONFromFile,
    loadJSONFromPath,
    copyJSONInput,
    clearJSONInput,
    copyJSONResultRawOutput,
  }
}
