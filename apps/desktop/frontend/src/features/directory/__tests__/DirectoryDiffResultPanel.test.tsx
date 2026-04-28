import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { DirectoryDiffResultPanel } from '../DirectoryDiffResultPanel'
import type { DiffDirectoriesResponse, DirectoryDiffItem } from '../../../types'

function makeItem(index: number): DirectoryDiffItem {
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
    diffModeHint: 'text',
  }
}

function buildDirectoryResult(items: DirectoryDiffItem[]): DiffDirectoriesResponse {
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

describe('DirectoryDiffResultPanel', () => {
  it('shows list rows incrementally with show more', () => {
    const items = Array.from({ length: 320 }, (_, i) => makeItem(i))

    render(
      <MantineProvider>
        <DirectoryDiffResultPanel
          directoryResult={buildDirectoryResult(items)}
          directoryStatus=""
          directoryLeftRoot="/left"
          directoryRightRoot="/right"
          directoryNameFilter=""
          directoryCurrentPath=""
          directoryViewMode="list"
          directoryQuickFilter="all"
          directoryQuickFilterCounts={{
            all: 320,
            changed: 320,
            'left-only': 0,
            'right-only': 0,
            'type-mismatch': 0,
            error: 0,
            same: 0,
          }}
          directorySortKey="name"
          directorySortDirection="asc"
          directoryOpenBusyPath=""
          directoryTreeLoadingPath=""
          selectedDirectoryItemPath=""
          sortedDirectoryItems={items}
          flattenedDirectoryTreeRows={[]}
          selectedDirectoryItemForDetail={null}
          directoryBreadcrumbs={[{ label: 'Root', path: '' }]}
          loading={false}
          onBrowseDirectoryRoot={vi.fn()}
          onSetDirectoryNameFilter={vi.fn()}
          onSetDirectoryViewMode={vi.fn()}
          onSetDirectoryQuickFilter={vi.fn()}
          onSelectDirectoryItemPath={vi.fn()}
          onNavigateDirectoryPath={vi.fn()}
          onApplyDirectorySort={vi.fn()}
          onOpenDirectoryEntryDiff={vi.fn()}
          onToggleDirectoryTreeNode={vi.fn()}
          onDirectoryRowDoubleClick={vi.fn()}
          onDirectoryTreeRowDoubleClick={vi.fn()}
          onDirectoryTableKeyDown={vi.fn()}
          onDirectoryTreeKeyDown={vi.fn()}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('file-299.txt')).toBeInTheDocument()
    expect(screen.queryByText('file-300.txt')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /show more/i }))

    expect(screen.getByText('file-300.txt')).toBeInTheDocument()
  })
})
