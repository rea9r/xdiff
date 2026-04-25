import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DesktopMainContent } from '../DesktopMainContent'
import type { FolderCompareItem } from '../../types'

const noop = vi.fn()

function renderWithProvider(node: ReactNode) {
  return render(<MantineProvider>{node}</MantineProvider>)
}

const textSourceProps = {
  oldSourcePath: '',
  newSourcePath: '',
  oldValue: '',
  newValue: '',
  busy: false,
  fileBusyTarget: null,
  clipboardBusyTarget: null,
  copyBusyTarget: null,
  onOpenFile: noop,
  onPasteClipboard: noop,
  onCopyInput: noop,
  onClearInput: noop,
  onOldChange: noop,
  onNewChange: noop,
}

const textResultProps = {
  textResult: null,
  textResultView: 'diff' as const,
  setTextResultView: noop,
  textDiffLayout: 'unified' as const,
  setTextDiffLayout: noop,
  textSearchQuery: '',
  setTextSearchQuery: noop,
  textActiveSearchIndex: 0,
  normalizedTextSearchQuery: '',
  textSearchMatches: [],
  textRichRows: null,
  textRichItems: null,
  omittedSectionIds: [],
  allOmittedSectionsExpanded: false,
  canRenderTextRich: false,
  textCopyBusy: false,
  copyTextResultRawOutput: noop,
  moveTextSearch: noop,
  toggleTextUnchangedSection: noop,
  toggleAllTextUnchangedSections: noop,
  isTextSectionExpanded: () => false,
  registerTextSearchRowRef: () => noop,
  textDiffBlocks: [],
  textActiveDiffIndex: 0,
  activeTextDiffBlock: null,
  moveTextDiff: noop,
}

const jsonSourceProps = {
  oldSourcePath: '',
  newSourcePath: '',
  oldValue: '',
  newValue: '',
  oldParseError: null,
  newParseError: null,
  busy: false,
  fileBusyTarget: null,
  clipboardBusyTarget: null,
  copyBusyTarget: null,
  onOpenFile: noop,
  onPasteClipboard: noop,
  onCopyInput: noop,
  onClearInput: noop,
  onOldChange: noop,
  onNewChange: noop,
}

const jsonResultProps = {
  jsonResult: null,
  jsonResultView: 'diff' as const,
  setJSONResultView: noop,
  textDiffLayout: 'unified' as const,
  setTextDiffLayout: noop,
  jsonSearchQuery: '',
  setJSONSearchQuery: noop,
  jsonActiveSearchIndex: 0,
  normalizedJSONSearchQuery: '',
  jsonSearchMatches: [],
  jsonDiffSearchMatches: [],
  jsonDiffSearchMatchIds: new Set<string>(),
  activeJSONDiffSearchMatchId: null,
  canRenderJSONRich: false,
  canRenderJSONDiff: false,
  jsonCopyBusy: false,
  copyJSONResultRawOutput: noop,
  moveJSONSearch: noop,
  jsonDiffTextItems: null,
  jsonDiffRows: [],
  jsonDiffGroups: [],
  effectiveJSONExpandedGroups: new Set<string>(),
  jsonSearchMatchIndexSet: new Set<number>(),
  jsonExpandedValueKeys: [],
  toggleJSONGroup: noop,
  toggleJSONExpandedValue: noop,
  registerJSONDiffSearchRowRef: () => noop,
  jsonDiffNavCount: 0,
  jsonActiveDiffIndex: 0,
  activeJSONSemanticDiffIndex: -1,
  jsonDiffTextBlockIds: new Set<string>(),
  activeJSONDiffTextBlockId: null,
  moveJSONDiff: noop,
  registerJSONSemanticDiffRowRef: () => noop,
}

const folderItem: FolderCompareItem = {
  name: 'file.txt',
  relativePath: 'file.txt',
  isDir: false,
  status: 'changed',
  leftPath: '/left/file.txt',
  rightPath: '/right/file.txt',
  leftExists: true,
  rightExists: true,
  leftKind: 'file',
  rightKind: 'file',
  leftSize: 1,
  rightSize: 2,
  compareModeHint: 'text',
}

const folderResultProps = {
  folderResult: {
    currentPath: '',
    scannedSummary: {
      total: 1,
      same: 0,
      changed: 1,
      leftOnly: 0,
      rightOnly: 0,
      typeMismatch: 0,
      error: 0,
    },
    currentSummary: {
      total: 1,
      same: 0,
      changed: 1,
      leftOnly: 0,
      rightOnly: 0,
      typeMismatch: 0,
      error: 0,
    },
    items: [folderItem],
  },
  folderStatus: '',
  folderLeftRoot: '/left',
  folderRightRoot: '/right',
  folderNameFilter: '',
  folderCurrentPath: '',
  folderViewMode: 'list' as const,
  folderQuickFilter: 'all' as const,
  folderQuickFilterCounts: {
    all: 1,
    changed: 1,
    'left-only': 0,
    'right-only': 0,
    'type-mismatch': 0,
    error: 0,
    same: 0,
  },
  folderSortKey: 'name' as const,
  folderSortDirection: 'asc' as const,
  folderOpenBusyPath: '',
  folderTreeLoadingPath: '',
  selectedFolderItemPath: '',
  sortedFolderItems: [folderItem],
  flattenedFolderTreeRows: [],
  selectedFolderItemForDetail: null,
  folderBreadcrumbs: [{ label: 'Root', path: '' }],
  loading: false,
  onBrowseFolderRoot: noop,
  onSetFolderNameFilter: noop,
  onSetFolderViewMode: noop,
  onSetFolderQuickFilter: noop,
  onSelectFolderItemPath: noop,
  onNavigateFolderPath: noop,
  onApplyFolderSort: noop,
  onOpenFolderEntryDiff: noop,
  onToggleFolderTreeNode: noop,
  onFolderRowDoubleClick: noop,
  onFolderTreeRowDoubleClick: noop,
  onFolderTableKeyDown: noop,
}

describe('DesktopMainContent', () => {
  it('renders text mode content and return banner action', async () => {
    const onReturnToFolderCompare = vi.fn()

    renderWithProvider(
      <DesktopMainContent
        mode="text"
        showFolderReturnBanner
        onReturnToFolderCompare={onReturnToFolderCompare}
        textSourceProps={textSourceProps}
        textResultProps={textResultProps}
        jsonSourceProps={jsonSourceProps}
        jsonResultProps={jsonResultProps}
        folderResultProps={folderResultProps}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /back to directory compare/i }))
    expect(onReturnToFolderCompare).toHaveBeenCalled()

    expect(await screen.findByText('Old text')).toBeInTheDocument()
  })

  it('renders folder mode result panel', async () => {
    renderWithProvider(
      <DesktopMainContent
        mode="folder"
        showFolderReturnBanner={false}
        onReturnToFolderCompare={noop}
        textSourceProps={textSourceProps}
        textResultProps={textResultProps}
        jsonSourceProps={jsonSourceProps}
        jsonResultProps={jsonResultProps}
        folderResultProps={folderResultProps}
      />,
    )

    expect(await screen.findByText('Directory Compare')).toBeInTheDocument()
  })
})
