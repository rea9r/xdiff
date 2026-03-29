import { useEffect, useMemo, useRef, useState } from 'react'
import type { CompareResponse } from '../../types'
import {
  buildRichDiffItems,
  buildTextSearchMatches,
  normalizeSearchQuery,
  parseUnifiedDiff,
} from './textDiff'

export type TextResultView = 'diff' | 'raw'
export type TextDiffLayout = 'split' | 'unified'

type UseTextDiffViewStateParams = {
  textResult: CompareResponse | null
  textLastRunOld: string
  textLastRunNew: string
  textLastRunOutputFormat: 'text' | 'json' | null
}

export function useTextDiffViewState({
  textResult,
  textLastRunOld,
  textLastRunNew,
  textLastRunOutputFormat,
}: UseTextDiffViewStateParams) {
  const [textResultView, setTextResultView] = useState<TextResultView>('diff')
  const [textDiffLayout, setTextDiffLayout] = useState<TextDiffLayout>('split')
  const [textExpandedUnchangedSectionIds, setTextExpandedUnchangedSectionIds] = useState<
    string[]
  >([])
  const [textSearchQuery, setTextSearchQuery] = useState('')
  const [textActiveSearchIndex, setTextActiveSearchIndex] = useState(0)
  const textSearchRowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const textRichRows = useMemo(
    () => (textResult?.output ? parseUnifiedDiff(textResult.output) : null),
    [textResult?.output],
  )
  const textRichItems = useMemo(
    () =>
      textRichRows ? buildRichDiffItems(textRichRows, textLastRunOld, textLastRunNew) : null,
    [textRichRows, textLastRunOld, textLastRunNew],
  )
  const normalizedTextSearchQuery = useMemo(
    () => normalizeSearchQuery(textSearchQuery),
    [textSearchQuery],
  )
  const textSearchMatches = useMemo(
    () =>
      textRichItems ? buildTextSearchMatches(textRichItems, normalizedTextSearchQuery) : [],
    [textRichItems, normalizedTextSearchQuery],
  )
  const textSearchMatchIds = useMemo(
    () => new Set(textSearchMatches.map((match) => match.id)),
    [textSearchMatches],
  )
  const activeTextSearchMatch = textSearchMatches[textActiveSearchIndex] ?? null
  const omittedSectionIds = useMemo(
    () =>
      textRichItems?.flatMap((item) => (item.kind === 'omitted' ? [item.sectionId] : [])) ?? [],
    [textRichItems],
  )
  const allOmittedSectionsExpanded =
    omittedSectionIds.length > 0 &&
    omittedSectionIds.every((id) => textExpandedUnchangedSectionIds.includes(id))
  const effectiveExpandedSectionIds = useMemo(() => {
    const ids = new Set(textExpandedUnchangedSectionIds)
    if (activeTextSearchMatch?.sectionId) {
      ids.add(activeTextSearchMatch.sectionId)
    }
    return [...ids]
  }, [textExpandedUnchangedSectionIds, activeTextSearchMatch?.sectionId])
  const canRenderTextRich =
    textLastRunOutputFormat === 'text' &&
    !!textResult &&
    !textResult.error &&
    !!textRichRows

  useEffect(() => {
    if (!textResult) {
      return
    }

    if (textResultView === 'diff' && !canRenderTextRich) {
      setTextResultView('raw')
    }
  }, [canRenderTextRich, textResult, textResultView])

  useEffect(() => {
    setTextActiveSearchIndex(0)
  }, [normalizedTextSearchQuery, textResult?.output])

  useEffect(() => {
    if (textSearchMatches.length === 0) {
      if (textActiveSearchIndex !== 0) {
        setTextActiveSearchIndex(0)
      }
      return
    }

    if (textActiveSearchIndex >= textSearchMatches.length) {
      setTextActiveSearchIndex(0)
    }
  }, [textSearchMatches.length, textActiveSearchIndex])

  useEffect(() => {
    if (textResultView !== 'diff' || !canRenderTextRich || !activeTextSearchMatch) {
      return
    }

    const node = textSearchRowRefs.current[activeTextSearchMatch.id]
    if (node) {
      node.scrollIntoView({ block: 'center' })
    }
  }, [
    activeTextSearchMatch?.id,
    canRenderTextRich,
    textDiffLayout,
    textResultView,
    effectiveExpandedSectionIds.join('|'),
  ])

  useEffect(() => {
    setTextExpandedUnchangedSectionIds((prev) =>
      prev.filter((id) => omittedSectionIds.includes(id)),
    )
  }, [omittedSectionIds])

  const clearTextExpandedSections = () => {
    setTextExpandedUnchangedSectionIds([])
  }

  const resetTextSearch = () => {
    setTextSearchQuery('')
    setTextActiveSearchIndex(0)
  }

  const isTextSectionExpanded = (sectionId: string) =>
    effectiveExpandedSectionIds.includes(sectionId)

  const isTextSearchMatchId = (matchId: string) => textSearchMatchIds.has(matchId)

  const isActiveTextSearchMatchId = (matchId: string) => activeTextSearchMatch?.id === matchId

  const registerTextSearchRowRef = (matchId: string) => (node: HTMLDivElement | null) => {
    if (node) {
      textSearchRowRefs.current[matchId] = node
      return
    }

    delete textSearchRowRefs.current[matchId]
  }

  const getTextSearchClassName = (matchId: string) => {
    if (!isTextSearchMatchId(matchId)) {
      return ''
    }

    return isActiveTextSearchMatchId(matchId) ? 'active-search-hit' : 'search-hit'
  }

  const moveTextSearch = (direction: 1 | -1) => {
    if (!canRenderTextRich || textSearchMatches.length === 0) {
      return
    }

    if (textResultView !== 'diff') {
      setTextResultView('diff')
    }

    setTextActiveSearchIndex((prev) =>
      direction === 1
        ? (prev + 1) % textSearchMatches.length
        : (prev - 1 + textSearchMatches.length) % textSearchMatches.length,
    )
  }

  const toggleTextUnchangedSection = (sectionId: string) => {
    setTextExpandedUnchangedSectionIds((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    )
  }

  const toggleAllTextUnchangedSections = () => {
    setTextExpandedUnchangedSectionIds(allOmittedSectionsExpanded ? [] : omittedSectionIds)
  }

  return {
    textResultView,
    setTextResultView,
    textDiffLayout,
    setTextDiffLayout,
    textSearchQuery,
    setTextSearchQuery,
    textActiveSearchIndex,
    normalizedTextSearchQuery,
    textSearchMatches,
    textRichRows,
    textRichItems,
    omittedSectionIds,
    allOmittedSectionsExpanded,
    canRenderTextRich,
    clearTextExpandedSections,
    resetTextSearch,
    isTextSectionExpanded,
    isTextSearchMatchId,
    registerTextSearchRowRef,
    getTextSearchClassName,
    moveTextSearch,
    toggleTextUnchangedSection,
    toggleAllTextUnchangedSections,
  }
}
