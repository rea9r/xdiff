import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiffResponse } from '../../types'
import { usePersistedState } from '../../usePersistedState'
import {
  buildRichDiffItems,
  buildTextChangeBlocks,
  buildTextDiffBlocks,
  buildTextSearchMatches,
  normalizeSearchQuery,
  parseUnifiedDiff,
} from './textDiff'

export type TextResultView = 'diff' | 'raw'
export type TextDiffLayout = 'split' | 'unified'

export type SectionExpansion = { top: number; bottom: number }
export type SectionExpansionMap = Record<string, SectionExpansion>

export const SECTION_EXPANSION_STEP = 20
const EMPTY_EXPANSION: SectionExpansion = { top: 0, bottom: 0 }

function clampNonNegative(value: number, max: number): number {
  if (value < 0) return 0
  return value > max ? max : value
}

type UseTextDiffViewStateParams = {
  textResult: DiffResponse | null
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
  const [textDiffLayout, setTextDiffLayout] = usePersistedState<TextDiffLayout>(
    'xdiff.desktop.textDiffLayout',
    'split',
    (value): value is TextDiffLayout => value === 'split' || value === 'unified',
  )
  const [textWrap, setTextWrap] = usePersistedState<boolean>(
    'xdiff.desktop.textWrap',
    true,
    (value): value is boolean => typeof value === 'boolean',
  )
  const [textSectionExpansions, setTextSectionExpansions] =
    useState<SectionExpansionMap>({})
  const [textSearchQuery, setTextSearchQuery] = useState('')
  const [textActiveSearchIndex, setTextActiveSearchIndex] = useState(0)
  const [textActiveDiffIndex, setTextActiveDiffIndex] = useState(0)
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
  const activeTextSearchMatch = textSearchMatches[textActiveSearchIndex] ?? null
  const textDiffBlocks = useMemo(
    () => (textRichItems ? buildTextDiffBlocks(textRichItems) : []),
    [textRichItems],
  )
  const textChangeBlocks = useMemo(
    () => (textRichItems ? buildTextChangeBlocks(textRichItems) : []),
    [textRichItems],
  )
  const activeTextDiffBlock = textDiffBlocks[textActiveDiffIndex] ?? null
  const omittedSectionIds = useMemo(
    () =>
      textRichItems?.flatMap((item) => (item.kind === 'omitted' ? [item.sectionId] : [])) ?? [],
    [textRichItems],
  )
  const sectionTotalsById = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of textRichItems ?? []) {
      if (item.kind === 'omitted') {
        map.set(item.sectionId, item.lines.length)
      }
    }
    return map
  }, [textRichItems])
  const isSectionFullyExpanded = (
    expansion: SectionExpansion,
    total: number,
  ): boolean => total === 0 || expansion.top + expansion.bottom >= total
  const allOmittedSectionsExpanded =
    omittedSectionIds.length > 0 &&
    omittedSectionIds.every((id) => {
      const total = sectionTotalsById.get(id) ?? 0
      const exp = textSectionExpansions[id] ?? EMPTY_EXPANSION
      return isSectionFullyExpanded(exp, total)
    })
  const effectiveSectionExpansions = useMemo<SectionExpansionMap>(() => {
    const sectionId = activeTextSearchMatch?.sectionId
    if (!sectionId) {
      return textSectionExpansions
    }
    const total = sectionTotalsById.get(sectionId) ?? 0
    if (total === 0) {
      return textSectionExpansions
    }
    const current = textSectionExpansions[sectionId] ?? EMPTY_EXPANSION
    if (isSectionFullyExpanded(current, total)) {
      return textSectionExpansions
    }
    return { ...textSectionExpansions, [sectionId]: { top: total, bottom: 0 } }
  }, [textSectionExpansions, activeTextSearchMatch?.sectionId, sectionTotalsById])
  const effectiveExpansionsSignature = useMemo(
    () =>
      Object.entries(effectiveSectionExpansions)
        .map(([id, exp]) => `${id}:${exp.top}/${exp.bottom}`)
        .sort()
        .join('|'),
    [effectiveSectionExpansions],
  )
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
    effectiveExpansionsSignature,
  ])

  useEffect(() => {
    setTextActiveDiffIndex(0)
  }, [textRichItems])

  useEffect(() => {
    if (textDiffBlocks.length === 0) {
      if (textActiveDiffIndex !== 0) {
        setTextActiveDiffIndex(0)
      }
      return
    }

    if (textActiveDiffIndex >= textDiffBlocks.length) {
      setTextActiveDiffIndex(0)
    }
  }, [textDiffBlocks.length, textActiveDiffIndex])

  useEffect(() => {
    if (textResultView !== 'diff' || !canRenderTextRich || !activeTextDiffBlock) {
      return
    }

    const node = textSearchRowRefs.current[activeTextDiffBlock.id]
    if (node) {
      node.scrollIntoView({ block: 'center' })
    }
  }, [activeTextDiffBlock?.id, canRenderTextRich, textDiffLayout, textResultView])

  useEffect(() => {
    setTextSectionExpansions((prev) => {
      const validIds = new Set(omittedSectionIds)
      let changed = false
      const next: SectionExpansionMap = {}
      for (const [id, expansion] of Object.entries(prev)) {
        if (validIds.has(id)) {
          next[id] = expansion
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [omittedSectionIds])

  const clearTextExpandedSections = () => {
    setTextSectionExpansions({})
  }

  const resetTextSearch = () => {
    setTextSearchQuery('')
    setTextActiveSearchIndex(0)
  }

  const getTextSectionExpansion = (sectionId: string): SectionExpansion =>
    effectiveSectionExpansions[sectionId] ?? EMPTY_EXPANSION

  const expandTextSection = (sectionId: string, side: 'top' | 'bottom' | 'all') => {
    const total = sectionTotalsById.get(sectionId) ?? 0
    if (total === 0) return

    setTextSectionExpansions((prev) => {
      const current = prev[sectionId] ?? EMPTY_EXPANSION
      if (side === 'all') {
        return { ...prev, [sectionId]: { top: total, bottom: 0 } }
      }
      if (side === 'top') {
        const remaining = total - current.bottom
        const nextTop = clampNonNegative(current.top + SECTION_EXPANSION_STEP, remaining)
        if (nextTop === current.top) return prev
        return { ...prev, [sectionId]: { top: nextTop, bottom: current.bottom } }
      }
      const remaining = total - current.top
      const nextBottom = clampNonNegative(current.bottom + SECTION_EXPANSION_STEP, remaining)
      if (nextBottom === current.bottom) return prev
      return { ...prev, [sectionId]: { top: current.top, bottom: nextBottom } }
    })
  }

  const registerTextSearchRowRef = (matchId: string) => (node: HTMLDivElement | null) => {
    if (node) {
      textSearchRowRefs.current[matchId] = node
      return
    }

    delete textSearchRowRefs.current[matchId]
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

  const moveTextDiff = (direction: 1 | -1) => {
    if (!canRenderTextRich || textDiffBlocks.length === 0) {
      return
    }

    if (textResultView !== 'diff') {
      setTextResultView('diff')
    }

    setTextActiveDiffIndex((prev) =>
      direction === 1
        ? (prev + 1) % textDiffBlocks.length
        : (prev - 1 + textDiffBlocks.length) % textDiffBlocks.length,
    )
  }

  const toggleAllTextUnchangedSections = () => {
    if (allOmittedSectionsExpanded) {
      setTextSectionExpansions({})
      return
    }
    const next: SectionExpansionMap = {}
    for (const id of omittedSectionIds) {
      const total = sectionTotalsById.get(id) ?? 0
      next[id] = { top: total, bottom: 0 }
    }
    setTextSectionExpansions(next)
  }

  return {
    textResultView,
    setTextResultView,
    textDiffLayout,
    setTextDiffLayout,
    textWrap,
    setTextWrap,
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
    getTextSectionExpansion,
    expandTextSection,
    registerTextSearchRowRef,
    moveTextSearch,
    toggleAllTextUnchangedSections,
    textDiffBlocks,
    textChangeBlocks,
    textActiveDiffIndex,
    activeTextDiffBlock,
    moveTextDiff,
  }
}
