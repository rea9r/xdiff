import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff, summarizeTextDiffCounts } from '../textDiff'

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
