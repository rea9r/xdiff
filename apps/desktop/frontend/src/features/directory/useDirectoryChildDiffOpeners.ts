import { useCallback } from 'react'
import type {
  DiffJSONRichResponse,
  DirectoryDiffItem,
  LoadTextFileRequest,
  LoadTextFileResponse,
  Mode,
} from '../../types'

type StructuredResultView = 'diff' | 'semantic' | 'raw'

type RunJSONDiffFromPathsOptions = {
  oldPath: string
  newPath: string
}

type RunTextDiffWithValuesOptions = {
  oldText: string
  newText: string
  oldSourcePath?: string
  newSourcePath?: string
}

type SetStructuredResultView = (value: StructuredResultView) => void

type UseDirectoryChildDiffOpenersOptions = {
  loadTextFile: ((req: LoadTextFileRequest) => Promise<LoadTextFileResponse>) | undefined
  runJSONDiffFromPaths: (options: RunJSONDiffFromPathsOptions) => Promise<DiffJSONRichResponse>
  runTextDiffWithValues: (options: RunTextDiffWithValuesOptions) => Promise<unknown>
  resetJSONSearch: () => void
  setJSONResultView: SetStructuredResultView
  clearTextExpandedSections: () => void
  resetTextSearch: () => void
  setMode: (value: Mode) => void
}

function chooseDefaultJSONDisplayMode(options: {
  hasDiffText: boolean
  canRenderSemantic: boolean
}): StructuredResultView {
  if (options.hasDiffText) {
    return 'diff'
  }
  if (options.canRenderSemantic) {
    return 'semantic'
  }
  return 'raw'
}

export function useDirectoryChildDiffOpeners({
  loadTextFile,
  runJSONDiffFromPaths,
  runTextDiffWithValues,
  resetJSONSearch,
  setJSONResultView,
  clearTextExpandedSections,
  resetTextSearch,
  setMode,
}: UseDirectoryChildDiffOpenersOptions) {
  const applyJSONResultView = useCallback((richResult: Pick<DiffJSONRichResponse, 'diffText' | 'result'>) => {
    resetJSONSearch()
    setJSONResultView(
      chooseDefaultJSONDisplayMode({
        hasDiffText: richResult.diffText.trim().length > 0,
        canRenderSemantic: !richResult.result.error,
      }),
    )
  }, [resetJSONSearch, setJSONResultView])

  const openDirectoryJSONDiff = useCallback(async (entry: DirectoryDiffItem) => {
    const richResult = await runJSONDiffFromPaths({
      oldPath: entry.leftPath,
      newPath: entry.rightPath,
    })
    applyJSONResultView(richResult)
    setMode('json')
  }, [applyJSONResultView, runJSONDiffFromPaths, setMode])

  const openDirectoryTextDiff = useCallback(async (entry: DirectoryDiffItem) => {
    if (!loadTextFile) {
      throw new Error('Wails bridge not available (LoadTextFile)')
    }

    const [leftLoaded, rightLoaded] = await Promise.all([
      loadTextFile({ path: entry.leftPath } satisfies LoadTextFileRequest),
      loadTextFile({ path: entry.rightPath } satisfies LoadTextFileRequest),
    ])

    await runTextDiffWithValues({
      oldText: leftLoaded.content,
      newText: rightLoaded.content,
      oldSourcePath: leftLoaded.path,
      newSourcePath: rightLoaded.path,
    })
    clearTextExpandedSections()
    resetTextSearch()
    setMode('text')
  }, [clearTextExpandedSections, loadTextFile, resetTextSearch, runTextDiffWithValues, setMode])

  return {
    applyJSONResultView,
    openDirectoryJSONDiff,
    openDirectoryTextDiff,
  }
}
