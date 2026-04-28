import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DesktopMainContent } from '../DesktopMainContent'
import type { DirectoryDiffItem } from '../../types'

const noop = vi.fn()

function renderWithProvider(node: ReactNode) {
  return render(<MantineProvider>{node}</MantineProvider>)
}

const textSourceProps = {
  oldSourcePath: '',
  newSourcePath: '',
  oldValue: '',
  newValue: '',
  oldEncoding: 'utf-8' as const,
  newEncoding: 'utf-8' as const,
  busy: false,
  fileBusyTarget: null,
  clipboardBusyTarget: null,
  copyBusyTarget: null,
  saveBusyTarget: null,
  onOpenFile: noop,
  onPasteClipboard: noop,
  onCopyInput: noop,
  onClearInput: noop,
  onSaveFile: noop,
  onEncodingChange: noop,
  onOldChange: noop,
  onNewChange: noop,
  onSwitchToJSON: noop,
}

const textResultProps = {
  textResult: null,
  textResultView: 'diff' as const,
  setTextResultView: noop,
  textDiffLayout: 'unified' as const,
  setTextDiffLayout: noop,
  textWrap: true,
  setTextWrap: noop,
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
  toggleAllTextUnchangedSections: noop,
  getTextSectionExpansion: () => ({ top: 0, bottom: 0 }),
  expandTextSection: noop,
  registerTextSearchRowRef: () => noop,
  textDiffBlocks: [],
  textChangeBlocks: [],
  textActiveDiffIndex: 0,
  activeTextDiffBlock: null,
  moveTextDiff: noop,
  ignoreWhitespace: false,
  onToggleIgnoreWhitespace: noop,
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
  textWrap: true,
  setTextWrap: noop,
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

const directoryItem: DirectoryDiffItem = {
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
  diffModeHint: 'text',
}

const directoryResultProps = {
  directoryResult: {
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
    items: [directoryItem],
  },
  directoryStatus: '',
  directoryLeftRoot: '/left',
  directoryRightRoot: '/right',
  directoryNameFilter: '',
  directoryCurrentPath: '',
  directoryViewMode: 'list' as const,
  directoryQuickFilter: 'all' as const,
  directoryQuickFilterCounts: {
    all: 1,
    changed: 1,
    'left-only': 0,
    'right-only': 0,
    'type-mismatch': 0,
    error: 0,
    same: 0,
  },
  directorySortKey: 'name' as const,
  directorySortDirection: 'asc' as const,
  directoryOpenBusyPath: '',
  directoryTreeLoadingPath: '',
  selectedDirectoryItemPath: '',
  sortedDirectoryItems: [directoryItem],
  flattenedDirectoryTreeRows: [],
  selectedDirectoryItemForDetail: null,
  directoryBreadcrumbs: [{ label: 'Root', path: '' }],
  loading: false,
  onBrowseDirectoryRoot: noop,
  onSetDirectoryNameFilter: noop,
  onSetDirectoryViewMode: noop,
  onSetDirectoryQuickFilter: noop,
  onSelectDirectoryItemPath: noop,
  onNavigateDirectoryPath: noop,
  onApplyDirectorySort: noop,
  onOpenDirectoryEntryDiff: noop,
  onToggleDirectoryTreeNode: noop,
  onDirectoryRowDoubleClick: noop,
  onDirectoryTreeRowDoubleClick: noop,
  onDirectoryTableKeyDown: noop,
  onDirectoryTreeKeyDown: noop,
}

describe('DesktopMainContent', () => {
  it('renders text mode content and return banner action', async () => {
    const onReturnToDirectoryDiff = vi.fn()

    renderWithProvider(
      <DesktopMainContent
        mode="text"
        showDirectoryReturnBanner
        onReturnToDirectoryDiff={onReturnToDirectoryDiff}
        textSourceProps={textSourceProps}
        textResultProps={textResultProps}
        jsonSourceProps={jsonSourceProps}
        jsonResultProps={jsonResultProps}
        directoryResultProps={directoryResultProps}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /back to directory diff/i }))
    expect(onReturnToDirectoryDiff).toHaveBeenCalled()

    expect(await screen.findByText('Old text')).toBeInTheDocument()
  })

  it('renders directory mode result panel', async () => {
    renderWithProvider(
      <DesktopMainContent
        mode="directory"
        showDirectoryReturnBanner={false}
        onReturnToDirectoryDiff={noop}
        textSourceProps={textSourceProps}
        textResultProps={textResultProps}
        jsonSourceProps={jsonSourceProps}
        jsonResultProps={jsonResultProps}
        directoryResultProps={directoryResultProps}
      />,
    )

    expect(await screen.findByText('file.txt')).toBeInTheDocument()
  })
})
