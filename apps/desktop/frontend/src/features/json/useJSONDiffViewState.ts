import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiffJSONRichResponse, JSONRichDiffItem } from '../../types'
import { createSearchRowRefRegistrar } from '../../ui/RichDiffViewer'
import {
  buildRichDiffItems,
  buildTextDiffBlocks,
  buildTextSearchMatches,
  normalizeSearchQuery,
  parseUnifiedDiff,
} from '../text/textDiff'

const buildJSONSemanticDiffRowID = (index: number) => `json-semantic-${index}`

export type JSONResultView = 'diff' | 'semantic' | 'raw'

export type JSONDiffGroup = {
  key: string
  items: JSONRichDiffItem[]
  summary: {
    added: number
    removed: number
    changed: number
    typeChanged: number
  }
}

type UseJSONDiffViewStateOptions = {
  jsonRichResult: DiffJSONRichResponse | null
  jsonOldText: string
  jsonNewText: string
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

function summarizeJSONSearchText(item: JSONRichDiffItem): string {
  return `${item.path}\n${stringifyJSONValue(item.oldValue)}\n${stringifyJSONValue(item.newValue)}`
}

function getJSONDiffGroupKey(path: string): string {
  if (!path) {
    return '(root)'
  }

  const dotIndex = path.indexOf('.')
  const bracketIndex = path.indexOf('[')
  const cutIndexes = [dotIndex, bracketIndex].filter((index) => index >= 0)
  if (cutIndexes.length === 0) {
    return path
  }

  const cutAt = Math.min(...cutIndexes)
  return path.slice(0, cutAt) || '(root)'
}

function buildJSONDiffGroups(diffs: JSONRichDiffItem[]): JSONDiffGroup[] {
  const map = new Map<string, JSONDiffGroup>()

  for (const diff of diffs) {
    const key = getJSONDiffGroupKey(diff.path)
    const group =
      map.get(key) ?? {
        key,
        items: [],
        summary: { added: 0, removed: 0, changed: 0, typeChanged: 0 },
      }

    group.items.push(diff)
    if (diff.type === 'added') group.summary.added++
    else if (diff.type === 'removed') group.summary.removed++
    else if (diff.type === 'changed') group.summary.changed++
    else if (diff.type === 'type_changed') group.summary.typeChanged++

    map.set(key, group)
  }

  return [...map.values()]
}

function buildJSONMatchGroupKeys(diffs: JSONRichDiffItem[], matchIndexes: number[]): string[] {
  const keys = new Set<string>()

  for (const index of matchIndexes) {
    const diff = diffs[index]
    if (!diff) {
      continue
    }

    keys.add(getJSONDiffGroupKey(diff.path))
  }

  return [...keys]
}

export function useJSONDiffViewState({
  jsonRichResult,
  jsonOldText,
  jsonNewText,
  textDiffLayout,
}: UseJSONDiffViewStateOptions) {
  const [jsonResultView, setJSONResultView] = useState<JSONResultView>('diff')
  const [jsonSearchQuery, setJSONSearchQuery] = useState('')
  const [jsonActiveSearchIndex, setJSONActiveSearchIndex] = useState(0)
  const [jsonActiveDiffIndex, setJSONActiveDiffIndex] = useState(0)
  const [jsonExpandedGroups, setJSONExpandedGroups] = useState<string[]>([])
  const [jsonExpandedValueKeys, setJSONExpandedValueKeys] = useState<string[]>([])

  const jsonDiffSearchRowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const registerJSONDiffSearchRowRef = createSearchRowRefRegistrar(jsonDiffSearchRowRefs)
  const jsonSemanticDiffRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const registerJSONSemanticDiffRowRef =
    (id: string) => (node: HTMLTableRowElement | null) => {
      if (node) {
        jsonSemanticDiffRowRefs.current[id] = node
        return
      }
      delete jsonSemanticDiffRowRefs.current[id]
    }

  const jsonResult = jsonRichResult?.result ?? null
  const jsonDiffRows = jsonRichResult?.diffs ?? []
  const jsonDiffTextRows = useMemo(
    () => (jsonRichResult?.diffText ? parseUnifiedDiff(jsonRichResult.diffText) : null),
    [jsonRichResult?.diffText],
  )
  const jsonDiffTextItems = useMemo(
    () =>
      jsonDiffTextRows ? buildRichDiffItems(jsonDiffTextRows, jsonOldText, jsonNewText) : null,
    [jsonDiffTextRows, jsonOldText, jsonNewText],
  )
  const jsonDiffGroups = useMemo(() => buildJSONDiffGroups(jsonDiffRows), [jsonDiffRows])
  const canRenderJSONRich = !!jsonRichResult && !jsonRichResult.result.error
  const canRenderJSONDiff = !!jsonRichResult && !jsonResult?.error && !!jsonDiffTextRows
  const normalizedJSONSearchQuery = useMemo(
    () => normalizeSearchQuery(jsonSearchQuery),
    [jsonSearchQuery],
  )
  const jsonSearchMatches = useMemo(() => {
    if (!normalizedJSONSearchQuery) {
      return []
    }

    return jsonDiffRows
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        summarizeJSONSearchText(item).toLowerCase().includes(normalizedJSONSearchQuery),
      )
      .map(({ index }) => index)
  }, [jsonDiffRows, normalizedJSONSearchQuery])
  const jsonDiffSearchMatches = useMemo(
    () =>
      jsonDiffTextItems
        ? buildTextSearchMatches(jsonDiffTextItems, normalizedJSONSearchQuery)
        : [],
    [jsonDiffTextItems, normalizedJSONSearchQuery],
  )
  const jsonDiffSearchMatchIds = useMemo(
    () => new Set(jsonDiffSearchMatches.map((match) => match.id)),
    [jsonDiffSearchMatches],
  )
  const activeJSONDiffSearchMatch = jsonDiffSearchMatches[jsonActiveSearchIndex] ?? null
  const jsonSearchMatchIndexSet = useMemo(
    () => new Set(jsonSearchMatches),
    [jsonSearchMatches],
  )
  const jsonMatchGroupKeys = useMemo(
    () => buildJSONMatchGroupKeys(jsonDiffRows, jsonSearchMatches),
    [jsonDiffRows, jsonSearchMatches],
  )

  const jsonDiffTextBlocks = useMemo(
    () => (jsonDiffTextItems ? buildTextDiffBlocks(jsonDiffTextItems) : []),
    [jsonDiffTextItems],
  )
  const jsonDiffTextBlockIds = useMemo(
    () => new Set(jsonDiffTextBlocks.map((block) => block.id)),
    [jsonDiffTextBlocks],
  )
  const jsonDiffNavCount =
    jsonResultView === 'semantic' ? jsonDiffRows.length : jsonDiffTextBlocks.length
  const activeJSONSemanticDiffItem =
    jsonResultView === 'semantic' ? (jsonDiffRows[jsonActiveDiffIndex] ?? null) : null
  const activeJSONSemanticDiffRowID =
    jsonResultView === 'semantic' && activeJSONSemanticDiffItem
      ? buildJSONSemanticDiffRowID(jsonActiveDiffIndex)
      : null
  const activeJSONSemanticDiffGroupKey = activeJSONSemanticDiffItem
    ? getJSONDiffGroupKey(activeJSONSemanticDiffItem.path)
    : null
  const activeJSONDiffTextBlockId =
    jsonResultView === 'diff' ? (jsonDiffTextBlocks[jsonActiveDiffIndex]?.id ?? null) : null

  const effectiveJSONExpandedGroups = useMemo(() => {
    const keys = new Set<string>(jsonExpandedGroups)
    for (const key of jsonMatchGroupKeys) {
      keys.add(key)
    }
    if (activeJSONSemanticDiffGroupKey) {
      keys.add(activeJSONSemanticDiffGroupKey)
    }
    return keys
  }, [jsonExpandedGroups, jsonMatchGroupKeys, activeJSONSemanticDiffGroupKey])

  useEffect(() => {
    if (!jsonRichResult) {
      return
    }

    if (jsonResultView === 'semantic' && !canRenderJSONRich) {
      setJSONResultView(canRenderJSONDiff ? 'diff' : 'raw')
      return
    }

    if (jsonResultView === 'diff' && !canRenderJSONDiff) {
      setJSONResultView(canRenderJSONRich ? 'semantic' : 'raw')
    }
  }, [canRenderJSONDiff, canRenderJSONRich, jsonRichResult, jsonResultView])

  useEffect(() => {
    setJSONExpandedGroups(jsonDiffGroups.map((group) => group.key))
    setJSONExpandedValueKeys([])
  }, [jsonDiffGroups])

  useEffect(() => {
    setJSONActiveSearchIndex(0)
  }, [normalizedJSONSearchQuery, jsonRichResult?.result.output])

  useEffect(() => {
    const targetLength =
      jsonResultView === 'semantic' ? jsonSearchMatches.length : jsonDiffSearchMatches.length
    if (targetLength === 0) {
      if (jsonActiveSearchIndex !== 0) {
        setJSONActiveSearchIndex(0)
      }
      return
    }

    if (jsonActiveSearchIndex >= targetLength) {
      setJSONActiveSearchIndex(0)
    }
  }, [jsonSearchMatches.length, jsonDiffSearchMatches.length, jsonActiveSearchIndex, jsonResultView])

  useEffect(() => {
    if (jsonResultView !== 'diff' || !canRenderJSONDiff || !activeJSONDiffSearchMatch) {
      return
    }

    const node = jsonDiffSearchRowRefs.current[activeJSONDiffSearchMatch.id]
    if (node) {
      node.scrollIntoView({ block: 'center' })
    }
  }, [activeJSONDiffSearchMatch?.id, canRenderJSONDiff, jsonResultView, textDiffLayout])

  useEffect(() => {
    setJSONActiveDiffIndex(0)
  }, [jsonDiffRows, jsonDiffTextItems, jsonResultView])

  useEffect(() => {
    if (jsonDiffNavCount === 0) {
      if (jsonActiveDiffIndex !== 0) {
        setJSONActiveDiffIndex(0)
      }
      return
    }

    if (jsonActiveDiffIndex >= jsonDiffNavCount) {
      setJSONActiveDiffIndex(0)
    }
  }, [jsonDiffNavCount, jsonActiveDiffIndex])

  useEffect(() => {
    if (jsonResultView !== 'semantic' || !activeJSONSemanticDiffRowID) {
      return
    }

    const node = jsonSemanticDiffRowRefs.current[activeJSONSemanticDiffRowID]
    if (node) {
      node.scrollIntoView({ block: 'center' })
    }
  }, [activeJSONSemanticDiffRowID, jsonResultView, effectiveJSONExpandedGroups])

  useEffect(() => {
    if (jsonResultView !== 'diff' || !canRenderJSONDiff || !activeJSONDiffTextBlockId) {
      return
    }

    const node = jsonDiffSearchRowRefs.current[activeJSONDiffTextBlockId]
    if (node) {
      node.scrollIntoView({ block: 'center' })
    }
  }, [activeJSONDiffTextBlockId, canRenderJSONDiff, jsonResultView, textDiffLayout])

  const moveJSONSearch = (direction: 1 | -1) => {
    const targetMatches =
      jsonResultView === 'semantic' ? jsonSearchMatches : jsonDiffSearchMatches
    const canSearch =
      jsonResultView === 'semantic'
        ? canRenderJSONRich
        : jsonResultView === 'diff'
          ? canRenderJSONDiff
          : false
    if (!canSearch || targetMatches.length === 0) {
      return
    }

    setJSONActiveSearchIndex((prev) =>
      direction === 1
        ? (prev + 1) % targetMatches.length
        : (prev - 1 + targetMatches.length) % targetMatches.length,
    )
  }

  const moveJSONDiff = (direction: 1 | -1) => {
    if (jsonDiffNavCount === 0) {
      return
    }

    setJSONActiveDiffIndex((prev) =>
      direction === 1
        ? (prev + 1) % jsonDiffNavCount
        : (prev - 1 + jsonDiffNavCount) % jsonDiffNavCount,
    )
  }

  const toggleJSONGroup = (groupKey: string) => {
    setJSONExpandedGroups((prev) =>
      prev.includes(groupKey)
        ? prev.filter((key) => key !== groupKey)
        : [...prev, groupKey],
    )
  }

  const toggleJSONExpandedValue = (valueKey: string) => {
    setJSONExpandedValueKeys((prev) =>
      prev.includes(valueKey)
        ? prev.filter((key) => key !== valueKey)
        : [...prev, valueKey],
    )
  }

  const resetJSONSearch = () => {
    setJSONSearchQuery('')
    setJSONActiveSearchIndex(0)
  }

  return {
    jsonResult,
    jsonResultView,
    setJSONResultView,
    jsonSearchQuery,
    setJSONSearchQuery,
    jsonActiveSearchIndex,
    normalizedJSONSearchQuery,
    jsonSearchMatches,
    jsonDiffSearchMatches,
    jsonDiffSearchMatchIds,
    activeJSONDiffSearchMatchId: activeJSONDiffSearchMatch?.id ?? null,
    canRenderJSONRich,
    canRenderJSONDiff,
    jsonDiffRows,
    jsonDiffTextItems,
    jsonDiffGroups,
    effectiveJSONExpandedGroups,
    jsonSearchMatchIndexSet,
    jsonExpandedValueKeys,
    moveJSONSearch,
    toggleJSONGroup,
    toggleJSONExpandedValue,
    registerJSONDiffSearchRowRef,
    resetJSONSearch,
    jsonDiffNavCount,
    jsonActiveDiffIndex,
    activeJSONSemanticDiffIndex:
      jsonResultView === 'semantic' ? jsonActiveDiffIndex : -1,
    jsonDiffTextBlockIds,
    activeJSONDiffTextBlockId,
    moveJSONDiff,
    registerJSONSemanticDiffRowRef,
  }
}

export { buildJSONSemanticDiffRowID }
