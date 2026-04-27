import { describe, expect, it } from 'vitest'
import type { DiffDirectoriesResponse, DirectoryDiffItem } from '../../../types'
import { formatDirectoryDiffForAI } from '../formatDirectoryDiffForAI'

function makeItem(
  relativePath: string,
  status: DirectoryDiffItem['status'],
  isDir = false,
  overrides: Partial<DirectoryDiffItem> = {},
): DirectoryDiffItem {
  return {
    name: relativePath.split('/').pop() ?? relativePath,
    relativePath,
    isDir,
    status,
    leftPath: `/left/${relativePath}`,
    rightPath: `/right/${relativePath}`,
    leftExists: true,
    rightExists: true,
    leftKind: isDir ? 'dir' : 'file',
    rightKind: isDir ? 'dir' : 'file',
    leftSize: 0,
    rightSize: 0,
    diffModeHint: isDir ? 'none' : 'text',
    ...overrides,
  }
}

const emptySummary = {
  total: 0,
  same: 0,
  changed: 0,
  leftOnly: 0,
  rightOnly: 0,
  typeMismatch: 0,
  error: 0,
}

describe('formatDirectoryDiffForAI', () => {
  it('omits "same" entries and groups by status', () => {
    const result: DiffDirectoriesResponse = {
      currentPath: '',
      scannedSummary: { ...emptySummary, total: 4, changed: 1, leftOnly: 1, rightOnly: 1, same: 1 },
      currentSummary: emptySummary,
      items: [
        makeItem('src/foo.ts', 'changed'),
        makeItem('src/unchanged.ts', 'same'),
        makeItem('legacy.go', 'left-only'),
        makeItem('feature.ts', 'right-only'),
      ],
    }

    const out = formatDirectoryDiffForAI(result)

    expect(out).toContain('scanned 4 entries')
    expect(out).toContain('# changed (1)')
    expect(out).toContain('# left-only (1)')
    expect(out).toContain('# right-only (1)')
    expect(out).toContain('[file] src/foo.ts')
    expect(out).toContain('[file] legacy.go')
    expect(out).not.toContain('unchanged.ts')
  })

  it('reports no differences when all items are same', () => {
    const result: DiffDirectoriesResponse = {
      currentPath: '',
      scannedSummary: { ...emptySummary, total: 2, same: 2 },
      currentSummary: emptySummary,
      items: [makeItem('a.ts', 'same'), makeItem('b.ts', 'same')],
    }

    expect(formatDirectoryDiffForAI(result)).toContain('No differences in scanned entries.')
  })

  it('annotates type-mismatch with kind transition', () => {
    const result: DiffDirectoriesResponse = {
      currentPath: '',
      scannedSummary: { ...emptySummary, total: 1, typeMismatch: 1 },
      currentSummary: emptySummary,
      items: [
        makeItem('config', 'type-mismatch', false, {
          leftKind: 'file',
          rightKind: 'dir',
        }),
      ],
    }

    const out = formatDirectoryDiffForAI(result)
    expect(out).toContain('# type-mismatch (1)')
    expect(out).toContain('[file→dir] config')
  })
})
