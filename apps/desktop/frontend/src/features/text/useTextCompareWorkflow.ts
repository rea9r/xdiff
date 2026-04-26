import { useCallback, useState } from 'react'
import { upsertRecentPair } from '../../persistence'
import type {
  CompareCommon,
  CompareResponse,
  DesktopRecentPair,
  LoadTextFileRequest,
  LoadTextFileResponse,
  TextEncoding,
} from '../../types'
import {
  formatUnknownError,
  getRuntimeClipboardRead,
  getRuntimeClipboardWrite,
  renderResult,
} from '../../utils/appHelpers'
import {
  showClipboardEmptyNotification,
  showClipboardUnavailableNotification,
  showErrorNotification,
  showSuccessNotification,
} from '../../utils/notifications'

export type TextInputTarget = 'old' | 'new'

type CompareTextFn = (req: {
  oldText: string
  newText: string
  common: CompareCommon
}) => Promise<CompareResponse>

type PickTextFileFn = () => Promise<string>
type LoadTextFileFn = (req: LoadTextFileRequest) => Promise<LoadTextFileResponse>

export type UseTextCompareWorkflowOptions = {
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
  const [textOldEncoding, setTextOldEncoding] = useState<TextEncoding>('utf-8')
  const [textNewEncoding, setTextNewEncoding] = useState<TextEncoding>('utf-8')
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
    setTextOldEncoding('utf-8')
  }, [])

  const setTextNewInput = useCallback((value: string) => {
    setTextNew(value)
    setTextNewSourcePath('')
    setTextNewEncoding('utf-8')
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

      setTextOldEncoding(oldLoaded.encoding ?? 'utf-8')
      setTextNewEncoding(newLoaded.encoding ?? 'utf-8')

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
      showClipboardUnavailableNotification()
      return
    }

    setTextClipboardBusyTarget(target)

    try {
      const pasted = await readClipboard()
      if (!pasted) {
        showClipboardEmptyNotification()
        return
      }

      if (target === 'old') {
        setTextOld(pasted)
        setTextOldSourcePath('')
        setTextOldEncoding('utf-8')
      } else {
        setTextNew(pasted)
        setTextNewSourcePath('')
        setTextNewEncoding('utf-8')
      }
    } catch (error) {
      showErrorNotification(
        'Failed to paste from clipboard',
        `Failed to read clipboard: ${formatUnknownError(error)}`,
      )
    } finally {
      setTextClipboardBusyTarget(null)
    }
  }, [])

  const loadTextFromFile = useCallback(
    async (target: TextInputTarget) => {
      const pickTextFile = getPickTextFile()
      const loadTextFile = getLoadTextFile()
      if (!pickTextFile || !loadTextFile) {
        showErrorNotification('Text loader unavailable', 'Text file loader is not available.')
        return
      }

      setTextFileBusyTarget(target)

      try {
        const selected = await pickTextFile()
        if (!selected) {
          return
        }

        const encoding = target === 'old' ? textOldEncoding : textNewEncoding
        const loaded = await loadTextFile({
          path: selected,
          encoding,
        } satisfies LoadTextFileRequest)

        if (target === 'old') {
          setTextOld(loaded.content)
          setTextOldSourcePath(loaded.path)
          setTextOldEncoding(loaded.encoding ?? encoding)
        } else {
          setTextNew(loaded.content)
          setTextNewSourcePath(loaded.path)
          setTextNewEncoding(loaded.encoding ?? encoding)
        }
      } catch (error) {
        showErrorNotification(
          'Failed to load text file',
          `Failed to load text file: ${formatUnknownError(error)}`,
        )
      } finally {
        setTextFileBusyTarget(null)
      }
    },
    [getLoadTextFile, getPickTextFile, textNewEncoding, textOldEncoding],
  )

  const reloadTextWithEncoding = useCallback(
    async (target: TextInputTarget, encoding: TextEncoding) => {
      const path = target === 'old' ? textOldSourcePath : textNewSourcePath
      if (target === 'old') {
        setTextOldEncoding(encoding)
      } else {
        setTextNewEncoding(encoding)
      }
      if (!path) {
        return
      }

      const loadTextFile = getLoadTextFile()
      if (!loadTextFile) {
        showErrorNotification('Text loader unavailable', 'Text file loader is not available.')
        return
      }

      setTextFileBusyTarget(target)
      try {
        const loaded = await loadTextFile({ path, encoding } satisfies LoadTextFileRequest)
        if (target === 'old') {
          setTextOld(loaded.content)
          setTextOldEncoding(loaded.encoding ?? encoding)
        } else {
          setTextNew(loaded.content)
          setTextNewEncoding(loaded.encoding ?? encoding)
        }
      } catch (error) {
        showErrorNotification(
          'Failed to reload text file',
          `Failed to reload as ${encoding}: ${formatUnknownError(error)}`,
        )
      } finally {
        setTextFileBusyTarget(null)
      }
    },
    [getLoadTextFile, textNewSourcePath, textOldSourcePath],
  )

  const clearTextInput = useCallback((target: TextInputTarget) => {
    if (target === 'old') {
      setTextOld('')
      setTextOldSourcePath('')
      setTextOldEncoding('utf-8')
      return
    }

    setTextNew('')
    setTextNewSourcePath('')
    setTextNewEncoding('utf-8')
  }, [])

  const copyTextInput = useCallback(
    async (target: TextInputTarget) => {
      const writeClipboard = getRuntimeClipboardWrite()
      if (!writeClipboard) {
        showClipboardUnavailableNotification()
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
          showErrorNotification(
            'Copy failed',
            `Failed to copy ${target === 'old' ? 'Old' : 'New'} text.`,
          )
          return
        }

        showSuccessNotification(
          'Copied',
          `${target === 'old' ? 'Old' : 'New'} text copied to clipboard.`,
        )
      } catch (error) {
        showErrorNotification('Copy failed', `Failed to copy text: ${formatUnknownError(error)}`)
      } finally {
        setTextPaneCopyBusyTarget(null)
      }
    },
    [textNew, textOld],
  )

  const copyTextResultRawOutput = useCallback(async () => {
    const writeClipboard = getRuntimeClipboardWrite()
    if (!writeClipboard) {
      showClipboardUnavailableNotification()
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
    textOldEncoding,
    textNewEncoding,
    setTextOldEncoding,
    setTextNewEncoding,
    reloadTextWithEncoding,
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
