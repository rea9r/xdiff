import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { DirectoryCompareResultPanel } from '../DirectoryCompareResultPanel'
import type { CompareFoldersResponse, FolderCompareItem } from '../../../types'

function makeItem(index: number): FolderCompareItem {
  return {
    name: `file-${index}.txt`,
    relativePath: `file-${index}.txt`,
    isDir: false,
    status: 'changed',
    leftPath: `/left/file-${index}.txt`,
    rightPath: `/right/file-${index}.txt`,
    leftExists: true,
    rightExists: true,
    leftKind: 'file',
    rightKind: 'file',
    leftSize: 10,
    rightSize: 20,
    compareModeHint: 'text',
  }
}

function buildFolderResult(items: FolderCompareItem[]): CompareFoldersResponse {
  return {
    currentPath: '',
    scannedSummary: {
      total: items.length,
      same: 0,
      changed: items.length,
      leftOnly: 0,
      rightOnly: 0,
      typeMismatch: 0,
      error: 0,
    },
    currentSummary: {
      total: items.length,
      same: 0,
      changed: items.length,
      leftOnly: 0,
      rightOnly: 0,
      typeMismatch: 0,
      error: 0,
    },
    items,
  }
}

describe('DirectoryCompareResultPanel', () => {
  it('shows list rows incrementally with show more', () => {
    const items = Array.from({ length: 320 }, (_, i) => makeItem(i))

    render(
      <MantineProvider>
        <DirectoryCompareResultPanel
          folderResult={buildFolderResult(items)}
          folderStatus=""
          folderLeftRoot="/left"
          folderRightRoot="/right"
          folderNameFilter=""
          folderCurrentPath=""
          folderViewMode="list"
          folderQuickFilter="all"
          folderQuickFilterCounts={{
            all: 320,
            changed: 320,
            'left-only': 0,
            'right-only': 0,
            'type-mismatch': 0,
            error: 0,
            same: 0,
          }}
          folderSortKey="name"
          folderSortDirection="asc"
          folderOpenBusyPath=""
          folderTreeLoadingPath=""
          selectedFolderItemPath=""
          sortedFolderItems={items}
          flattenedFolderTreeRows={[]}
          selectedFolderItemForDetail={null}
          folderBreadcrumbs={[{ label: 'Root', path: '' }]}
          loading={false}
          onBrowseFolderRoot={vi.fn()}
          onSetFolderNameFilter={vi.fn()}
          onSetFolderViewMode={vi.fn()}
          onSetFolderQuickFilter={vi.fn()}
          onSelectFolderItemPath={vi.fn()}
          onNavigateFolderPath={vi.fn()}
          onApplyFolderSort={vi.fn()}
          onOpenFolderEntryDiff={vi.fn()}
          onToggleFolderTreeNode={vi.fn()}
          onFolderRowDoubleClick={vi.fn()}
          onFolderTreeRowDoubleClick={vi.fn()}
          onFolderTableKeyDown={vi.fn()}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('file-299.txt')).toBeInTheDocument()
    expect(screen.queryByText('file-300.txt')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /show more/i }))

    expect(screen.getByText('file-300.txt')).toBeInTheDocument()
  })
})
