export type UnifiedDiffRowKind = 'meta' | 'hunk' | 'context' | 'add' | 'remove'
export type InlineDiffKind = 'same' | 'add' | 'remove'

export type InlineDiffSegment = {
  kind: InlineDiffKind
  text: string
}

export type UnifiedDiffRow = {
  kind: UnifiedDiffRowKind
  oldLine: number | null
  newLine: number | null
  content: string
  inlineSegments?: InlineDiffSegment[]
}

export type RichDiffItem =
  | {
      kind: 'row'
      row: UnifiedDiffRow
    }
  | {
      kind: 'omitted'
      sectionId: string
      startOldLine: number
      startNewLine: number
      lines: string[]
    }

export type OmittedDiffItem = Extract<RichDiffItem, { kind: 'omitted' }>

export type TextSearchMatch = {
  id: string
  sectionId: string | null
}

export function shouldHideTextRichMetaRow(row: UnifiedDiffRow): boolean {
  return row.kind === 'meta' && (row.content.startsWith('--- ') || row.content.startsWith('+++ '))
}

export function shouldShowTextHunkHeaders(items: RichDiffItem[]): boolean {
  const hunkCount = items.filter(
    (item) => item.kind === 'row' && item.row.kind === 'hunk',
  ).length
  const hasOmitted = items.some((item) => item.kind === 'omitted')
  return hunkCount > 1 || hasOmitted
}

export function summarizeTextDiffCounts(rows: UnifiedDiffRow[] | null): {
  added: number
  removed: number
} {
  if (!rows) {
    return { added: 0, removed: 0 }
  }

  let added = 0
  let removed = 0

  for (const row of rows) {
    if (row.kind === 'add') {
      added++
    } else if (row.kind === 'remove') {
      removed++
    }
  }

  return { added, removed }
}

function tokenizeInlineDiff(input: string): string[] {
  if (input.length === 0) {
    return ['']
  }

  const tokens = input.match(/(\s+|[^\s]+)/g)
  return tokens && tokens.length > 0 ? tokens : [input]
}

function pushInlineSegment(
  target: InlineDiffSegment[],
  kind: InlineDiffKind,
  text: string,
) {
  if (text.length === 0) {
    return
  }

  const last = target[target.length - 1]
  if (last && last.kind === kind) {
    last.text += text
    return
  }

  target.push({ kind, text })
}

function buildLCSTable(a: string[], b: string[]): number[][] {
  const table = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  )

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        table[i][j] = table[i + 1][j + 1] + 1
      } else {
        table[i][j] = Math.max(table[i + 1][j], table[i][j + 1])
      }
    }
  }

  return table
}

function buildInlineDiffPair(
  oldText: string,
  newText: string,
): { removed: InlineDiffSegment[]; added: InlineDiffSegment[] } | null {
  if (oldText === newText) {
    return {
      removed: [{ kind: 'same', text: oldText }],
      added: [{ kind: 'same', text: newText }],
    }
  }

  if (oldText.length + newText.length > 4000) {
    return null
  }

  const oldTokens = tokenizeInlineDiff(oldText)
  const newTokens = tokenizeInlineDiff(newText)

  if (oldTokens.length * newTokens.length > 40000) {
    return null
  }

  const table = buildLCSTable(oldTokens, newTokens)
  const removed: InlineDiffSegment[] = []
  const added: InlineDiffSegment[] = []

  let i = 0
  let j = 0

  while (i < oldTokens.length && j < newTokens.length) {
    if (oldTokens[i] === newTokens[j]) {
      pushInlineSegment(removed, 'same', oldTokens[i])
      pushInlineSegment(added, 'same', newTokens[j])
      i++
      j++
      continue
    }

    if (table[i + 1][j] >= table[i][j + 1]) {
      pushInlineSegment(removed, 'remove', oldTokens[i])
      i++
      continue
    }

    pushInlineSegment(added, 'add', newTokens[j])
    j++
  }

  while (i < oldTokens.length) {
    pushInlineSegment(removed, 'remove', oldTokens[i])
    i++
  }

  while (j < newTokens.length) {
    pushInlineSegment(added, 'add', newTokens[j])
    j++
  }

  return { removed, added }
}

function addInlineDiffSegments(rows: UnifiedDiffRow[]): UnifiedDiffRow[] {
  const enriched = rows.map((row) => ({ ...row }))
  let index = 0

  while (index < enriched.length) {
    if (enriched[index].kind !== 'remove' && enriched[index].kind !== 'add') {
      index++
      continue
    }

    const removedIndexes: number[] = []
    const addedIndexes: number[] = []
    let end = index

    while (
      end < enriched.length &&
      (enriched[end].kind === 'remove' || enriched[end].kind === 'add')
    ) {
      if (enriched[end].kind === 'remove') {
        removedIndexes.push(end)
      } else {
        addedIndexes.push(end)
      }
      end++
    }

    const pairCount = Math.min(removedIndexes.length, addedIndexes.length)

    for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
      const removedRow = enriched[removedIndexes[pairIndex]]
      const addedRow = enriched[addedIndexes[pairIndex]]

      const pair = buildInlineDiffPair(removedRow.content, addedRow.content)
      if (!pair) {
        continue
      }

      removedRow.inlineSegments = pair.removed
      addedRow.inlineSegments = pair.added
    }

    index = end
  }

  return enriched
}

export function parseUnifiedDiff(output: string): UnifiedDiffRow[] | null {
  const lines = output.split('\n')
  const rows: UnifiedDiffRow[] = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === lines.length - 1 && line === '') {
      continue
    }

    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      rows.push({ kind: 'meta', oldLine: null, newLine: null, content: line })
      continue
    }

    if (line.startsWith('@@ ')) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (!match) {
        return null
      }
      oldLine = Number(match[1])
      newLine = Number(match[2])
      inHunk = true
      rows.push({ kind: 'hunk', oldLine: null, newLine: null, content: line })
      continue
    }

    if (!inHunk) {
      rows.push({ kind: 'meta', oldLine: null, newLine: null, content: line })
      continue
    }

    if (line.startsWith('+')) {
      rows.push({
        kind: 'add',
        oldLine: null,
        newLine,
        content: line.slice(1),
      })
      newLine++
      continue
    }

    if (line.startsWith('-')) {
      rows.push({
        kind: 'remove',
        oldLine,
        newLine: null,
        content: line.slice(1),
      })
      oldLine++
      continue
    }

    if (line.startsWith(' ')) {
      rows.push({
        kind: 'context',
        oldLine,
        newLine,
        content: line.slice(1),
      })
      oldLine++
      newLine++
      continue
    }

    rows.push({ kind: 'meta', oldLine: null, newLine: null, content: line })
  }

  return addInlineDiffSegments(rows)
}

function splitTextForDisplay(input: string): string[] {
  const lines = input.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

function parseHunkHeader(content: string): {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
} | null {
  const match = content.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
  if (!match) {
    return null
  }

  return {
    oldStart: Number(match[1]),
    oldCount: match[2] ? Number(match[2]) : 1,
    newStart: Number(match[3]),
    newCount: match[4] ? Number(match[4]) : 1,
  }
}

export function buildExpandedContextRow(
  content: string,
  oldLine: number,
  newLine: number,
): UnifiedDiffRow {
  return {
    kind: 'context',
    oldLine,
    newLine,
    content,
  }
}

function buildOmittedSectionID(
  oldStart: number,
  oldCount: number,
  newStart: number,
  newCount: number,
): string {
  return `omitted-${oldStart}-${oldCount}-${newStart}-${newCount}`
}

function pushOmittedItem(
  items: RichDiffItem[],
  oldLines: string[],
  newLines: string[],
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
) {
  const oldCount = oldEnd - oldStart + 1
  const newCount = newEnd - newStart + 1
  const count = Math.min(oldCount, newCount)

  if (count <= 0) {
    return
  }

  const lines = oldLines.slice(oldStart - 1, oldStart - 1 + count)
  if (lines.length === 0) {
    return
  }

  items.push({
    kind: 'omitted',
    sectionId: buildOmittedSectionID(oldStart, count, newStart, count),
    startOldLine: oldStart,
    startNewLine: newStart,
    lines,
  })
}

export function buildRichDiffItems(
  rows: UnifiedDiffRow[],
  oldText: string,
  newText: string,
): RichDiffItem[] {
  const oldLines = splitTextForDisplay(oldText)
  const newLines = splitTextForDisplay(newText)
  const items: RichDiffItem[] = []

  let previousShownOld = 0
  let previousShownNew = 0
  let sawHunk = false

  for (const row of rows) {
    if (row.kind === 'hunk') {
      const parsed = parseHunkHeader(row.content)
      if (parsed) {
        sawHunk = true
        pushOmittedItem(
          items,
          oldLines,
          newLines,
          previousShownOld + 1,
          parsed.oldStart - 1,
          previousShownNew + 1,
          parsed.newStart - 1,
        )
      }

      items.push({ kind: 'row', row })
      continue
    }

    items.push({ kind: 'row', row })

    if (row.kind === 'context') {
      previousShownOld = row.oldLine ?? previousShownOld
      previousShownNew = row.newLine ?? previousShownNew
      continue
    }

    if (row.kind === 'remove') {
      previousShownOld = row.oldLine ?? previousShownOld
      continue
    }

    if (row.kind === 'add') {
      previousShownNew = row.newLine ?? previousShownNew
    }
  }

  if (sawHunk) {
    pushOmittedItem(
      items,
      oldLines,
      newLines,
      previousShownOld + 1,
      oldLines.length,
      previousShownNew + 1,
      newLines.length,
    )
  }

  return items
}

export function buildTextSearchRowIDForItem(itemIndex: number): string {
  return `search-row-${itemIndex}`
}

export function buildTextSearchRowIDForOmitted(sectionId: string, lineIndex: number): string {
  return `search-omitted-${sectionId}-${lineIndex}`
}

export function normalizeSearchQuery(input: string): string {
  return input.trim().toLowerCase()
}

function isSearchableDiffRow(row: UnifiedDiffRow): boolean {
  return row.kind === 'context' || row.kind === 'add' || row.kind === 'remove'
}

function contentMatchesSearch(content: string, normalizedQuery: string): boolean {
  return normalizedQuery.length > 0 && content.toLowerCase().includes(normalizedQuery)
}

export function buildTextSearchMatches(
  items: RichDiffItem[],
  normalizedQuery: string,
): TextSearchMatch[] {
  if (!normalizedQuery) {
    return []
  }

  const matches: TextSearchMatch[] = []

  items.forEach((item, itemIndex) => {
    if (item.kind === 'row') {
      if (!isSearchableDiffRow(item.row)) {
        return
      }

      if (contentMatchesSearch(item.row.content, normalizedQuery)) {
        matches.push({
          id: buildTextSearchRowIDForItem(itemIndex),
          sectionId: null,
        })
      }
      return
    }

    item.lines.forEach((line, lineIndex) => {
      if (!contentMatchesSearch(line, normalizedQuery)) {
        return
      }

      matches.push({
        id: buildTextSearchRowIDForOmitted(item.sectionId, lineIndex),
        sectionId: item.sectionId,
      })
    })
  })

  return matches
}
