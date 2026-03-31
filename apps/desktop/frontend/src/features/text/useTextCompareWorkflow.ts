import { useCallback, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { upsertRecentPair } from '../../persistence'
import type {
  CompareCommon,
  CompareResponse,
  DesktopRecentPair,
  LoadTextFileRequest,
  LoadTextFileResponse,
} from '../../types'
import {
  formatUnknownError,
  getRuntimeClipboardRead,
  getRuntimeClipboardWrite,
  renderResult,
} from '../../utils/appHelpers'

export type TextInputTarget = 'old' | 'new'

type CompareTextFn = (req: {
  oldText: string
  newText: string
  common: CompareCommon
}) => Promise<CompareResponse>

type PickTextFileFn = () => Promise<string>
type LoadTextFileFn = (req: LoadTextFileRequest) => Promise<LoadTextFileResponse>

type UseTextCompareWorkflowOptions = {
  initialCommon: CompareCommon
  getCompareText: () => CompareTextFn | undefined
  getPickTextFile: () => PickTextFileFn | undefined
  getLoadTextFile: () => LoadTextFileFn | undefined
  onTextCompareCompleted?: (res: CompareResponse) => void
}

type RunTextCompareWithValuesOptions = {
  oldText: string
  newText: string
  oldSourcePath?: string
  newSourcePath?: string
}

export function useTextCompareWorkflow({
  initialCommon,
  getCompareText,
  getPickTextFile,
  getLoadTextFile,
  onTextCompareCompleted,
}: UseTextCompareWorkflowOptions) {
  const [textOld, setTextOld] = useState('')
  const [textNew, setTextNew] = useState('')
  const [textOldSourcePath, setTextOldSourcePath] = useState('')
  const [textNewSourcePath, setTextNewSourcePath] = useState('')
  const [textCommon, setTextCommon] = useState<CompareCommon>(initialCommon)
  const [textResult, setTextResult] = useState<CompareResponse | null>(null)
  const [textLastRunOld, setTextLastRunOld] = useState('')
  const [textLastRunNew, setTextLastRunNew] = useState('')
  const [textLastRunOutputFormat, setTextLastRunOutputFormat] = useState<
    'text' | 'json' | null
  >(null)
  const [textClipboardBusyTarget, setTextClipboardBusyTarget] =
    useState<TextInputTarget | null>(null)
  const [textFileBusyTarget, setTextFileBusyTarget] = useState<TextInputTarget | null>(null)
  const [textCopyBusy, setTextCopyBusy] = useState(false)
  const [textPaneCopyBusyTarget, setTextPaneCopyBusyTarget] =
    useState<TextInputTarget | null>(null)
  const [textRecentPairs, setTextRecentPairs] = useState<DesktopRecentPair[]>([])

  const textEditorBusy = textClipboardBusyTarget !== null || textFileBusyTarget !== null

  const nowISO = () => new Date().toISOString()

  const updateTextCommon = useCallback(
    <K extends keyof CompareCommon>(key: K, value: CompareCommon[K]) => {
      setTextCommon((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const setTextOldInput = useCallback((value: string) => {
    setTextOld(value)
    setTextOldSourcePath('')
  }, [])

  const setTextNewInput = useCallback((value: string) => {
    setTextNew(value)
    setTextNewSourcePath('')
  }, [])

  const applyComparedTextPair = useCallback(
    (params: RunTextCompareWithValuesOptions & { result: CompareResponse }) => {
      const {
        oldText: nextOldText,
        newText: nextNewText,
        oldSourcePath = '',
        newSourcePath = '',
        result,
      } = params

      setTextOld(nextOldText)
      setTextNew(nextNewText)
      setTextOldSourcePath(oldSourcePath)
      setTextNewSourcePath(newSourcePath)
      setTextResult(result)
      setTextLastRunOld(nextOldText)
      setTextLastRunNew(nextNewText)
      setTextLastRunOutputFormat(textCommon.outputFormat === 'json' ? 'json' : 'text')
      onTextCompareCompleted?.(result)

      if (oldSourcePath.trim() && newSourcePath.trim()) {
        setTextRecentPairs((prev) =>
          upsertRecentPair(prev, {
            oldPath: oldSourcePath,
            newPath: newSourcePath,
            usedAt: nowISO(),
          }),
        )
      }
    },
    [onTextCompareCompleted, textCommon.outputFormat],
  )

  const runTextCompareWithValues = useCallback(
    async ({ oldText: nextOldText, newText: nextNewText, oldSourcePath = '', newSourcePath = '' }: RunTextCompareWithValuesOptions) => {
      const compareText = getCompareText()
      if (!compareText) {
        throw new Error('Wails bridge not available (CompareText)')
      }

      const result = await compareText({
        oldText: nextOldText,
        newText: nextNewText,
        common: textCommon,
      })

      applyComparedTextPair({
        oldText: nextOldText,
        newText: nextNewText,
        oldSourcePath,
        newSourcePath,
        result,
      })

      return result
    },
    [applyComparedTextPair, getCompareText, textCommon],
  )

  const runText = useCallback(async () => {
    await runTextCompareWithValues({
      oldText: textOld,
      newText: textNew,
      oldSourcePath: textOldSourcePath,
      newSourcePath: textNewSourcePath,
    })
  }, [runTextCompareWithValues, textNew, textNewSourcePath, textOld, textOldSourcePath])

  const runTextFromRecent = useCallback(
    async (pair: DesktopRecentPair) => {
      const loadTextFile = getLoadTextFile()
      if (!loadTextFile) {
        throw new Error('Wails bridge not available (LoadTextFile)')
      }

      const [oldLoaded, newLoaded] = await Promise.all([
        loadTextFile({ path: pair.oldPath } satisfies LoadTextFileRequest),
        loadTextFile({ path: pair.newPath } satisfies LoadTextFileRequest),
      ])

      await runTextCompareWithValues({
        oldText: oldLoaded.content,
        newText: newLoaded.content,
        oldSourcePath: oldLoaded.path,
        newSourcePath: newLoaded.path,
      })
    },
    [getLoadTextFile, runTextCompareWithValues],
  )

  const pasteTextFromClipboard = useCallback(async (target: TextInputTarget) => {
    const readClipboard = getRuntimeClipboardRead()
    if (!readClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    setTextClipboardBusyTarget(target)

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
        setTextOld(pasted)
        setTextOldSourcePath('')
      } else {
        setTextNew(pasted)
        setTextNewSourcePath('')
      }
    } catch (error) {
      notifications.show({
        title: 'Failed to paste from clipboard',
        message: `Failed to read clipboard: ${formatUnknownError(error)}`,
        color: 'red',
      })
    } finally {
      setTextClipboardBusyTarget(null)
    }
  }, [])

  const loadTextFromFile = useCallback(
    async (target: TextInputTarget) => {
      const pickTextFile = getPickTextFile()
      const loadTextFile = getLoadTextFile()
      if (!pickTextFile || !loadTextFile) {
        notifications.show({
          title: 'Text loader unavailable',
          message: 'Text file loader is not available.',
          color: 'red',
        })
        return
      }

      setTextFileBusyTarget(target)

      try {
        const selected = await pickTextFile()
        if (!selected) {
          return
        }

        const loaded = await loadTextFile({
          path: selected,
        } satisfies LoadTextFileRequest)

        if (target === 'old') {
          setTextOld(loaded.content)
          setTextOldSourcePath(loaded.path)
        } else {
          setTextNew(loaded.content)
          setTextNewSourcePath(loaded.path)
        }
      } catch (error) {
        notifications.show({
          title: 'Failed to load text file',
          message: `Failed to load text file: ${formatUnknownError(error)}`,
          color: 'red',
        })
      } finally {
        setTextFileBusyTarget(null)
      }
    },
    [getLoadTextFile, getPickTextFile],
  )

  const clearTextInput = useCallback((target: TextInputTarget) => {
    if (target === 'old') {
      setTextOld('')
      setTextOldSourcePath('')
      return
    }

    setTextNew('')
    setTextNewSourcePath('')
  }, [])

  const copyTextInput = useCallback(
    async (target: TextInputTarget) => {
      const writeClipboard = getRuntimeClipboardWrite()
      if (!writeClipboard) {
        notifications.show({
          title: 'Clipboard unavailable',
          message: 'Clipboard runtime is not available.',
          color: 'red',
        })
        return
      }

      const value = target === 'old' ? textOld : textNew
      if (!value) {
        return
      }

      setTextPaneCopyBusyTarget(target)

      try {
        const ok = await writeClipboard(value)
        if (!ok) {
          notifications.show({
            title: 'Copy failed',
            message: `Failed to copy ${target === 'old' ? 'Old' : 'New'} text.`,
            color: 'red',
          })
          return
        }

        notifications.show({
          title: 'Copied',
          message: `${target === 'old' ? 'Old' : 'New'} text copied to clipboard.`,
          color: 'green',
        })
      } catch (error) {
        notifications.show({
          title: 'Copy failed',
          message: `Failed to copy text: ${formatUnknownError(error)}`,
          color: 'red',
        })
      } finally {
        setTextPaneCopyBusyTarget(null)
      }
    },
    [textNew, textOld],
  )

  const copyTextResultRawOutput = useCallback(async () => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      notifications.show({
        title: 'Clipboard unavailable',
        message: 'Clipboard runtime is not available.',
        color: 'red',
      })
      return
    }

    const raw = textResult ? renderResult(textResult) : ''
    if (!raw) {
      return
    }

    setTextCopyBusy(true)

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
      setTextCopyBusy(false)
    }
  }, [textResult])

  return {
    textOld,
    setTextOld,
    setTextOldInput,
    textNew,
    setTextNew,
    setTextNewInput,
    textOldSourcePath,
    setTextOldSourcePath,
    textNewSourcePath,
    setTextNewSourcePath,
    textCommon,
    setTextCommon,
    updateTextCommon,
    textResult,
    setTextResult,
    textLastRunOld,
    setTextLastRunOld,
    textLastRunNew,
    setTextLastRunNew,
    textLastRunOutputFormat,
    setTextLastRunOutputFormat,
    textClipboardBusyTarget,
    textFileBusyTarget,
    textCopyBusy,
    textPaneCopyBusyTarget,
    textEditorBusy,
    textRecentPairs,
    setTextRecentPairs,
    runText,
    runTextFromRecent,
    runTextCompareWithValues,
    pasteTextFromClipboard,
    loadTextFromFile,
    copyTextInput,
    clearTextInput,
    copyTextResultRawOutput,
  }
}
