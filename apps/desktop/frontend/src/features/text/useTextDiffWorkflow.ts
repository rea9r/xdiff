import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { upsertRecentPair } from '../../persistence'
import type {
  DiffCommon,
  DiffResponse,
  DesktopRecentPair,
  LoadTextFileRequest,
  LoadTextFileResponse,
  SaveTextFileRequest,
  SaveTextFileResponse,
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

type DiffTextFn = (req: {
  oldText: string
  newText: string
  common: DiffCommon
}) => Promise<DiffResponse>

type PickTextFileFn = () => Promise<string>
type PickSaveTextFileFn = (defaultName: string) => Promise<string>
type LoadTextFileFn = (req: LoadTextFileRequest) => Promise<LoadTextFileResponse>
type SaveTextFileFn = (req: SaveTextFileRequest) => Promise<SaveTextFileResponse>

export type UseTextDiffWorkflowOptions = {
  initialCommon: DiffCommon
  getDiffText: () => DiffTextFn | undefined
  getPickTextFile: () => PickTextFileFn | undefined
  getPickSaveTextFile: () => PickSaveTextFileFn | undefined
  getLoadTextFile: () => LoadTextFileFn | undefined
  getSaveTextFile: () => SaveTextFileFn | undefined
  onTextDiffCompleted?: (res: DiffResponse) => void
  setTextRecentPairs: Dispatch<SetStateAction<DesktopRecentPair[]>>
}

type RunTextDiffWithValuesOptions = {
  oldText: string
  newText: string
  oldSourcePath?: string
  newSourcePath?: string
}

export function useTextDiffWorkflow({
  initialCommon,
  getDiffText,
  getPickTextFile,
  getPickSaveTextFile,
  getLoadTextFile,
  getSaveTextFile,
  onTextDiffCompleted,
  setTextRecentPairs,
}: UseTextDiffWorkflowOptions) {
  const [textOld, setTextOld] = useState('')
  const [textNew, setTextNew] = useState('')
  const [textOldSourcePath, setTextOldSourcePath] = useState('')
  const [textNewSourcePath, setTextNewSourcePath] = useState('')
  const [textOldEncoding, setTextOldEncoding] = useState<TextEncoding>('utf-8')
  const [textNewEncoding, setTextNewEncoding] = useState<TextEncoding>('utf-8')
  const [textCommon, setTextCommon] = useState<DiffCommon>(initialCommon)
  const [textResult, setTextResult] = useState<DiffResponse | null>(null)
  const [textLastRunOld, setTextLastRunOld] = useState('')
  const [textLastRunNew, setTextLastRunNew] = useState('')
  const [textLastRunOutputFormat, setTextLastRunOutputFormat] = useState<
    'text' | 'json' | null
  >(null)
  const [textClipboardBusyTarget, setTextClipboardBusyTarget] =
    useState<TextInputTarget | null>(null)
  const [textFileBusyTarget, setTextFileBusyTarget] = useState<TextInputTarget | null>(null)
  const [textSaveBusyTarget, setTextSaveBusyTarget] = useState<TextInputTarget | null>(null)
  const [textCopyBusy, setTextCopyBusy] = useState(false)
  const [textPaneCopyBusyTarget, setTextPaneCopyBusyTarget] =
    useState<TextInputTarget | null>(null)

  const textEditorBusy =
    textClipboardBusyTarget !== null ||
    textFileBusyTarget !== null ||
    textSaveBusyTarget !== null

  const nowISO = () => new Date().toISOString()

  const updateTextCommon = useCallback(
    <K extends keyof DiffCommon>(key: K, value: DiffCommon[K]) => {
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

  const applyDiffedTextPair = useCallback(
    (params: RunTextDiffWithValuesOptions & { result: DiffResponse }) => {
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
      onTextDiffCompleted?.(result)

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
    [onTextDiffCompleted, setTextRecentPairs, textCommon.outputFormat],
  )

  const runTextDiffWithValues = useCallback(
    async ({ oldText: nextOldText, newText: nextNewText, oldSourcePath = '', newSourcePath = '' }: RunTextDiffWithValuesOptions) => {
      const diffText = getDiffText()
      if (!diffText) {
        throw new Error('Wails bridge not available (DiffText)')
      }

      const result = await diffText({
        oldText: nextOldText,
        newText: nextNewText,
        common: textCommon,
      })

      applyDiffedTextPair({
        oldText: nextOldText,
        newText: nextNewText,
        oldSourcePath,
        newSourcePath,
        result,
      })

      return result
    },
    [applyDiffedTextPair, getDiffText, textCommon],
  )

  const runText = useCallback(async () => {
    await runTextDiffWithValues({
      oldText: textOld,
      newText: textNew,
      oldSourcePath: textOldSourcePath,
      newSourcePath: textNewSourcePath,
    })
  }, [runTextDiffWithValues, textNew, textNewSourcePath, textOld, textOldSourcePath])

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

      await runTextDiffWithValues({
        oldText: oldLoaded.content,
        newText: newLoaded.content,
        oldSourcePath: oldLoaded.path,
        newSourcePath: newLoaded.path,
      })
    },
    [getLoadTextFile, runTextDiffWithValues],
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

  const loadTextFromPath = useCallback(
    async (target: TextInputTarget, path: string) => {
      const loadTextFile = getLoadTextFile()
      if (!loadTextFile) {
        showErrorNotification('Text loader unavailable', 'Text file loader is not available.')
        return
      }

      setTextFileBusyTarget(target)

      try {
        const encoding = target === 'old' ? textOldEncoding : textNewEncoding
        const loaded = await loadTextFile({
          path,
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
    [getLoadTextFile, textNewEncoding, textOldEncoding],
  )

  const loadTextFromFile = useCallback(
    async (target: TextInputTarget) => {
      const pickTextFile = getPickTextFile()
      if (!pickTextFile) {
        showErrorNotification('Text loader unavailable', 'Text file loader is not available.')
        return
      }

      const selected = await pickTextFile()
      if (!selected) {
        return
      }

      await loadTextFromPath(target, selected)
    },
    [getPickTextFile, loadTextFromPath],
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

  const saveTextSide = useCallback(
    async (
      target: TextInputTarget,
      options: { saveAs?: boolean } = {},
    ): Promise<boolean> => {
      const saveTextFile = getSaveTextFile()
      if (!saveTextFile) {
        showErrorNotification('Save unavailable', 'Text save is not available.')
        return false
      }

      const content = target === 'old' ? textOld : textNew
      const sourcePath = target === 'old' ? textOldSourcePath : textNewSourcePath
      const encoding = target === 'old' ? textOldEncoding : textNewEncoding

      let path = sourcePath
      if (options.saveAs || !path) {
        const pickSaveTextFile = getPickSaveTextFile()
        if (!pickSaveTextFile) {
          showErrorNotification('Save unavailable', 'Save dialog is not available.')
          return false
        }
        const fallbackName = target === 'old' ? 'old.txt' : 'new.txt'
        const defaultName = sourcePath
          ? sourcePath.split(/[/\\]/).pop() ?? fallbackName
          : fallbackName
        const picked = await pickSaveTextFile(defaultName)
        if (!picked) {
          return false
        }
        path = picked
      }

      setTextSaveBusyTarget(target)
      try {
        const resp = await saveTextFile({ path, content, encoding })
        const savedPath = resp.path ?? path
        const savedEncoding = (resp.encoding as TextEncoding | undefined) ?? encoding
        if (target === 'old') {
          setTextOldSourcePath(savedPath)
          setTextOldEncoding(savedEncoding)
        } else {
          setTextNewSourcePath(savedPath)
          setTextNewEncoding(savedEncoding)
        }
        showSuccessNotification(
          'Saved',
          `${target === 'old' ? 'Old' : 'New'} text saved to ${savedPath}.`,
        )
        return true
      } catch (error) {
        showErrorNotification(
          'Save failed',
          `Failed to save text file: ${formatUnknownError(error)}`,
        )
        return false
      } finally {
        setTextSaveBusyTarget(null)
      }
    },
    [
      getPickSaveTextFile,
      getSaveTextFile,
      textNew,
      textNewEncoding,
      textNewSourcePath,
      textOld,
      textOldEncoding,
      textOldSourcePath,
    ],
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
    textSaveBusyTarget,
    textCopyBusy,
    textPaneCopyBusyTarget,
    textEditorBusy,
    runText,
    runTextFromRecent,
    runTextDiffWithValues,
    pasteTextFromClipboard,
    loadTextFromFile,
    loadTextFromPath,
    saveTextSide,
    copyTextInput,
    clearTextInput,
    copyTextResultRawOutput,
  }
}
