import { useCallback } from 'react'
import type {
  CompareJSONRichResponse,
  CompareSpecRichResponse,
  FolderCompareItem,
  LoadTextFileRequest,
  LoadTextFileResponse,
  Mode,
} from '../../types'

type StructuredResultView = 'diff' | 'semantic' | 'raw'

type RunJSONCompareFromPathsOptions = {
  oldPath: string
  newPath: string
}

type RunSpecCompareFromPathsOptions = {
  oldPath: string
  newPath: string
}

type RunTextCompareWithValuesOptions = {
  oldText: string
  newText: string
  oldSourcePath?: string
  newSourcePath?: string
}

type SetStructuredResultView = (value: StructuredResultView) => void

type UseFolderChildDiffOpenersOptions = {
  loadTextFile: ((req: LoadTextFileRequest) => Promise<LoadTextFileResponse>) | undefined
  runJSONCompareFromPaths: (options: RunJSONCompareFromPathsOptions) => Promise<CompareJSONRichResponse>
  runSpecCompareFromPaths: (options: RunSpecCompareFromPathsOptions) => Promise<CompareSpecRichResponse>
  runTextCompareWithValues: (options: RunTextCompareWithValuesOptions) => Promise<unknown>
  resetJSONSearch: () => void
  setJSONResultView: SetStructuredResultView
  resetSpecSearch: () => void
  setSpecResultView: SetStructuredResultView
  clearTextExpandedSections: () => void
  resetTextSearch: () => void
  setMode: (value: Mode) => void
}

function chooseDefaultDisplayModeForMode(options: {
  mode: 'json' | 'spec'
  hasDiffText: boolean
  canRenderSemantic: boolean
}): StructuredResultView {
  if (options.mode === 'json') {
    if (options.hasDiffText) {
      return 'diff'
    }
    if (options.canRenderSemantic) {
      return 'semantic'
    }
    return 'raw'
  }

  if (options.canRenderSemantic) {
    return 'semantic'
  }
  if (options.hasDiffText) {
    return 'diff'
  }
  return 'raw'
}

export function useFolderChildDiffOpeners({
  loadTextFile,
  runJSONCompareFromPaths,
  runSpecCompareFromPaths,
  runTextCompareWithValues,
  resetJSONSearch,
  setJSONResultView,
  resetSpecSearch,
  setSpecResultView,
  clearTextExpandedSections,
  resetTextSearch,
  setMode,
}: UseFolderChildDiffOpenersOptions) {
  const applyJSONResultView = useCallback((richResult: Pick<CompareJSONRichResponse, 'diffText' | 'result'>) => {
    resetJSONSearch()
    setJSONResultView(
      chooseDefaultDisplayModeForMode({
        mode: 'json',
        hasDiffText: richResult.diffText.trim().length > 0,
        canRenderSemantic: !richResult.result.error,
      }),
    )
  }, [resetJSONSearch, setJSONResultView])

  const applySpecResultView = useCallback((richResult: Pick<CompareSpecRichResponse, 'diffText' | 'result'>) => {
    resetSpecSearch()
    setSpecResultView(
      chooseDefaultDisplayModeForMode({
        mode: 'spec',
        hasDiffText: richResult.diffText.trim().length > 0,
        canRenderSemantic: !richResult.result.error,
      }),
    )
  }, [resetSpecSearch, setSpecResultView])

  const openFolderJSONDiff = useCallback(async (entry: FolderCompareItem) => {
    const richResult = await runJSONCompareFromPaths({
      oldPath: entry.leftPath,
      newPath: entry.rightPath,
    })
    applyJSONResultView(richResult)
    setMode('json')
  }, [applyJSONResultView, runJSONCompareFromPaths, setMode])

  const openFolderSpecDiff = useCallback(async (entry: FolderCompareItem) => {
    const richResult = await runSpecCompareFromPaths({
      oldPath: entry.leftPath,
      newPath: entry.rightPath,
    })
    applySpecResultView(richResult)
    setMode('spec')
  }, [applySpecResultView, runSpecCompareFromPaths, setMode])

  const openFolderTextDiff = useCallback(async (entry: FolderCompareItem) => {
    if (!loadTextFile) {
      throw new Error('Wails bridge not available (LoadTextFile)')
    }

    const [leftLoaded, rightLoaded] = await Promise.all([
      loadTextFile({ path: entry.leftPath } satisfies LoadTextFileRequest),
      loadTextFile({ path: entry.rightPath } satisfies LoadTextFileRequest),
    ])

    await runTextCompareWithValues({
      oldText: leftLoaded.content,
      newText: rightLoaded.content,
      oldSourcePath: leftLoaded.path,
      newSourcePath: rightLoaded.path,
    })
    clearTextExpandedSections()
    resetTextSearch()
    setMode('text')
  }, [clearTextExpandedSections, loadTextFile, resetTextSearch, runTextCompareWithValues, setMode])

  return {
    applyJSONResultView,
    applySpecResultView,
    openFolderJSONDiff,
    openFolderSpecDiff,
    openFolderTextDiff,
  }
}
