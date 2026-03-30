import { useEffect, useMemo, useRef, useState } from 'react'
import type { CompareSpecRichResponse, SpecRichDiffItem } from '../../types'
import { createSearchRowRefRegistrar } from '../../ui/RichDiffViewer'
import {
  buildRichDiffItems,
  buildTextSearchMatches,
  normalizeSearchQuery,
  parseUnifiedDiff,
} from '../text/textDiff'

type SpecResultView = 'diff' | 'semantic' | 'raw'

type UseSpecCompareViewStateOptions = {
  specRichResult: CompareSpecRichResponse | null
  specOldText: string
  specNewText: string
  textDiffLayout: 'split' | 'unified'
}

function stringifyJSONValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function summarizeSpecSearchText(item: SpecRichDiffItem): string {
  return `${item.label}\n${item.path}\n${stringifyJSONValue(item.oldValue)}\n${stringifyJSONValue(item.newValue)}`
}

export function useSpecCompareViewState({
  specRichResult,
  specOldText,
  specNewText,
  textDiffLayout,
}: UseSpecCompareViewStateOptions) {
  const [specResultView, setSpecResultView] = useState<SpecResultView>('diff')
  const [specSearchQuery, setSpecSearchQuery] = useState('')
  const [specActiveSearchIndex, setSpecActiveSearchIndex] = useState(0)

  const specDiffSearchRowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const registerSpecDiffSearchRowRef = createSearchRowRefRegistrar(specDiffSearchRowRefs)

  const specResult = specRichResult?.result ?? null
  const specDiffRows = specRichResult?.diffs ?? []
  const specDiffTextRows = useMemo(
    () => (specRichResult?.diffText ? parseUnifiedDiff(specRichResult.diffText) : null),
    [specRichResult?.diffText],
  )
  const specDiffTextItems = useMemo(
    () =>
      specDiffTextRows ? buildRichDiffItems(specDiffTextRows, specOldText, specNewText) : null,
    [specDiffTextRows, specOldText, specNewText],
  )
  const canRenderSpecDiff = !!specRichResult && !specResult?.error && !!specDiffTextRows
  const normalizedSpecSearchQuery = useMemo(
    () => normalizeSearchQuery(specSearchQuery),
    [specSearchQuery],
  )
  const specSearchMatches = useMemo(() => {
    if (!normalizedSpecSearchQuery) {
      return []
    }

    return specDiffRows
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        summarizeSpecSearchText(item).toLowerCase().includes(normalizedSpecSearchQuery),
      )
      .map(({ index }) => index)
  }, [specDiffRows, normalizedSpecSearchQuery])
  const specDiffSearchMatches = useMemo(
    () =>
      specDiffTextItems
        ? buildTextSearchMatches(specDiffTextItems, normalizedSpecSearchQuery)
        : [],
    [specDiffTextItems, normalizedSpecSearchQuery],
  )
  const specDiffSearchMatchIds = useMemo(
    () => new Set(specDiffSearchMatches.map((match) => match.id)),
    [specDiffSearchMatches],
  )
  const activeSpecDiffSearchMatch = specDiffSearchMatches[specActiveSearchIndex] ?? null
  const specSearchMatchIndexSet = useMemo(
    () => new Set(specSearchMatches),
    [specSearchMatches],
  )

  useEffect(() => {
    if (!specRichResult) {
      return
    }

    if (specResultView === 'semantic' && !!specResult?.error) {
      setSpecResultView(canRenderSpecDiff ? 'diff' : 'raw')
      return
    }

    if (specResultView === 'diff' && !canRenderSpecDiff) {
      setSpecResultView(!specResult?.error ? 'semantic' : 'raw')
    }
  }, [canRenderSpecDiff, specRichResult, specResult?.error, specResultView])

  useEffect(() => {
    setSpecActiveSearchIndex(0)
  }, [normalizedSpecSearchQuery, specRichResult?.result.output])

  useEffect(() => {
    const targetLength =
      specResultView === 'semantic' ? specSearchMatches.length : specDiffSearchMatches.length
    if (targetLength === 0) {
      if (specActiveSearchIndex !== 0) {
        setSpecActiveSearchIndex(0)
      }
      return
    }

    if (specActiveSearchIndex >= targetLength) {
      setSpecActiveSearchIndex(0)
    }
  }, [specSearchMatches.length, specDiffSearchMatches.length, specActiveSearchIndex, specResultView])

  useEffect(() => {
    if (specResultView !== 'diff' || !canRenderSpecDiff || !activeSpecDiffSearchMatch) {
      return
    }

    const node = specDiffSearchRowRefs.current[activeSpecDiffSearchMatch.id]
    if (node) {
      node.scrollIntoView({ block: 'center' })
    }
  }, [activeSpecDiffSearchMatch?.id, canRenderSpecDiff, specResultView, textDiffLayout])

  const moveSpecSearch = (direction: 1 | -1) => {
    const targetMatches =
      specResultView === 'semantic' ? specSearchMatches : specDiffSearchMatches
    const canSearch =
      specResultView === 'semantic'
        ? !!specRichResult && !specResult?.error
        : specResultView === 'diff'
          ? canRenderSpecDiff
          : false
    if (!canSearch || targetMatches.length === 0) {
      return
    }

    setSpecActiveSearchIndex((prev) =>
      direction === 1
        ? (prev + 1) % targetMatches.length
        : (prev - 1 + targetMatches.length) % targetMatches.length,
    )
  }

  const resetSpecSearch = () => {
    setSpecSearchQuery('')
    setSpecActiveSearchIndex(0)
  }

  return {
    specResult,
    specResultView,
    setSpecResultView,
    specSearchQuery,
    setSpecSearchQuery,
    specActiveSearchIndex,
    normalizedSpecSearchQuery,
    specSearchMatches,
    specDiffSearchMatches,
    specDiffSearchMatchIds,
    activeSpecDiffSearchMatchId: activeSpecDiffSearchMatch?.id ?? null,
    canRenderSpecDiff,
    specDiffTextItems,
    specSearchMatchIndexSet,
    moveSpecSearch,
    registerSpecDiffSearchRowRef,
    resetSpecSearch,
  }
}
