import { describe, expect, it } from 'vitest'
import {
  buildRichDiffItems,
  buildTextDiffBlocks,
  buildTextSearchRowIDForItem,
  parseUnifiedDiff,
  summarizeTextDiffCounts,
} from '../textDiff'

describe('textDiff helpers', () => {
  it('parses unified diff rows and counts add/remove lines', () => {
    const raw = [
      '--- a.txt',
      '+++ b.txt',
      '@@ -1,2 +1,2 @@',
      '-old line',
      '+new line',
      ' shared',
    ].join('\n')

    const rows = parseUnifiedDiff(raw)
    expect(rows).not.toBeNull()

    const counts = summarizeTextDiffCounts(rows)
    expect(counts).toEqual({ added: 1, removed: 1 })
  })

  it('returns null for invalid hunk header', () => {
    const raw = [
      '--- a.txt',
      '+++ b.txt',
      '@@ invalid @@',
      '-old line',
      '+new line',
    ].join('\n')

    expect(parseUnifiedDiff(raw)).toBeNull()
  })
})

describe('buildTextDiffBlocks', () => {
  it('returns empty list when there are no changes', () => {
    const oldText = 'a\nb\nc\n'
    const raw = [
      '--- a.txt',
      '+++ b.txt',
      '@@ -1,3 +1,3 @@',
      ' a',
      ' b',
      ' c',
    ].join('\n')

    const rows = parseUnifiedDiff(raw)!
    const items = buildRichDiffItems(rows, oldText, oldText)
    expect(buildTextDiffBlocks(items)).toEqual([])
  })

  it('groups consecutive add/remove rows into a single block', () => {
    const oldText = 'a\nb\nc\n'
    const newText = 'a\nB1\nB2\nc\n'
    const raw = [
      '--- a.txt',
      '+++ b.txt',
      '@@ -1,3 +1,4 @@',
      ' a',
      '-b',
      '+B1',
      '+B2',
      ' c',
    ].join('\n')

    const rows = parseUnifiedDiff(raw)!
    const items = buildRichDiffItems(rows, oldText, newText)
    const blocks = buildTextDiffBlocks(items)
    expect(blocks).toHaveLength(1)

    const firstChangeIndex = items.findIndex(
      (item) =>
        item.kind === 'row' && (item.row.kind === 'add' || item.row.kind === 'remove'),
    )
    expect(blocks[0].id).toBe(buildTextSearchRowIDForItem(firstChangeIndex))
  })

  it('treats blocks separated by context as distinct', () => {
    const oldText = 'a\nb\nc\nd\n'
    const newText = 'A\nb\nc\nD\n'
    const raw = [
      '--- a.txt',
      '+++ b.txt',
      '@@ -1,4 +1,4 @@',
      '-a',
      '+A',
      ' b',
      ' c',
      '-d',
      '+D',
    ].join('\n')

    const rows = parseUnifiedDiff(raw)!
    const items = buildRichDiffItems(rows, oldText, newText)
    expect(buildTextDiffBlocks(items)).toHaveLength(2)
  })
})
