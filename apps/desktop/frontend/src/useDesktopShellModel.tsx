import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { IconChevronDown } from '@tabler/icons-react'
import type {
  DiffDirectoriesResponse,
  Mode,
} from './types'
import { parseIgnorePaths } from './utils/appHelpers'
import { DesktopDiffOptionsContent } from './ui/DesktopDiffOptionsContent'
import { DesktopMainContent } from './ui/DesktopMainContent'
import { useDirectoryDiffViewState } from './features/directory/useDirectoryDiffViewState'
import { useDirectoryDiffWorkflow } from './features/directory/useDirectoryDiffWorkflow'
import { useDirectoryDiffChildActions } from './features/directory/useDirectoryDiffChildActions'
import { useDirectoryDiffInteractions } from './features/directory/useDirectoryDiffInteractions'
import { useTextDiffViewState } from './features/text/useTextDiffViewState'
import { useTextDiffWorkflow } from './features/text/useTextDiffWorkflow'
import { applyChangeBlockToNew, applyChangeBlockToOld } from './features/text/textDiff'
import { showAdoptNotification, showErrorNotification } from './utils/notifications'
import { formatUnknownError } from './utils/appHelpers'
import type { AdoptBlockHandler } from './ui/RichDiffViewer'
import { useJSONDiffViewState } from './features/json/useJSONDiffViewState'
import { useJSONDiffWorkflow } from './features/json/useJSONDiffWorkflow'

type DesktopShellModel = {
  layoutMode: 'workspace' | 'sidebar'
  sidebar: ReactNode | undefined
  main: ReactNode
  inspector: ReactNode | undefined
  inspectorOpen: boolean
  isDirty: boolean
}

type TextAdoptSnapshot = {
  oldText: string
  newText: string
}

type UseDesktopShellModelArgs = {
  mode: Mode
  setMode: (mode: Mode) => void
  loading: boolean
  diffOptionsOpened: boolean
  onCloseDiffOptions: () => void
  jsonWorkflow: ReturnType<typeof useJSONDiffWorkflow>
  jsonViewState: ReturnType<typeof useJSONDiffViewState>
  textWorkflow: ReturnType<typeof useTextDiffWorkflow>
  textViewState: ReturnType<typeof useTextDiffViewState>
  directoryLeftRoot: string
  directoryRightRoot: string
  directoryNameFilter: string
  setDirectoryNameFilter: (value: string) => void
  directoryCurrentPath: string
  directoryResult: DiffDirectoriesResponse | null
  directoryStatus: string
  directoryViewState: ReturnType<typeof useDirectoryDiffViewState>
  directoryWorkflow: ReturnType<typeof useDirectoryDiffWorkflow>
  directoryChildDiffActions: ReturnType<typeof useDirectoryDiffChildActions>
  directoryInteractions: ReturnType<typeof useDirectoryDiffInteractions>
}

export function useDesktopShellModel({
  mode,
  setMode,
  loading,
  diffOptionsOpened,
  onCloseDiffOptions,
  jsonWorkflow,
  jsonViewState,
  textWorkflow,
  textViewState,
  directoryLeftRoot,
  directoryRightRoot,
  directoryNameFilter,
  setDirectoryNameFilter,
  directoryCurrentPath,
  directoryResult,
  directoryStatus,
  directoryViewState,
  directoryWorkflow,
  directoryChildDiffActions,
  directoryInteractions,
}: UseDesktopShellModelArgs): DesktopShellModel {
  const isDiffCentricMode = mode === 'text' || mode === 'json'

  const diffOptionsTitle =
    mode === 'text' ? 'Text diff options' : 'JSON diff options'

  const diffOptionsContent = (
    <DesktopDiffOptionsContent
      mode={mode}
      jsonProps={{
        ignoreOrder: jsonWorkflow.ignoreOrder,
        onIgnoreOrderChange: jsonWorkflow.setIgnoreOrder,
        outputFormat: jsonWorkflow.jsonCommon.outputFormat,
        onOutputFormatChange: (value) => jsonWorkflow.updateJSONCommon('outputFormat', value),
        textStyle: jsonWorkflow.jsonCommon.textStyle,
        onTextStyleChange: (value) => jsonWorkflow.updateJSONCommon('textStyle', value),
        patchTextStyleDisabled: jsonWorkflow.jsonPatchBlockedByFilters,
        ignorePathsDraft: jsonWorkflow.jsonIgnorePathsDraft,
        onIgnorePathsDraftChange: jsonWorkflow.setJSONIgnorePathsDraft,
        onIgnorePathsCommit: (value) =>
          jsonWorkflow.updateJSONCommon('ignorePaths', parseIgnorePaths(value)),
      }}
      textProps={{
        outputFormat: textWorkflow.textCommon.outputFormat,
        onOutputFormatChange: (value) => textWorkflow.updateTextCommon('outputFormat', value),
        ignoreWhitespace: textWorkflow.textCommon.ignoreWhitespace,
        onIgnoreWhitespaceChange: (checked) =>
          textWorkflow.updateTextCommon('ignoreWhitespace', checked),
        ignoreCase: textWorkflow.textCommon.ignoreCase,
        onIgnoreCaseChange: (checked) => textWorkflow.updateTextCommon('ignoreCase', checked),
        ignoreEOL: textWorkflow.textCommon.ignoreEOL,
        onIgnoreEOLChange: (checked) => textWorkflow.updateTextCommon('ignoreEOL', checked),
      }}
    />
  )

  const sidebar = undefined

  const [textAdoptUndoStack, setTextAdoptUndoStack] = useState<TextAdoptSnapshot[]>([])
  const [textAdoptRedoStack, setTextAdoptRedoStack] = useState<TextAdoptSnapshot[]>([])

  const restoreTextAdoptSnapshot = (snapshot: TextAdoptSnapshot) => {
    textWorkflow.setTextOld(snapshot.oldText)
    textWorkflow.setTextNew(snapshot.newText)

    void textWorkflow
      .runTextDiffWithValues({
        oldText: snapshot.oldText,
        newText: snapshot.newText,
        oldSourcePath: textWorkflow.textOldSourcePath,
        newSourcePath: textWorkflow.textNewSourcePath,
      })
      .catch((error) => {
        showErrorNotification(
          'Failed to restore previous state',
          `Failed to re-compute diff: ${formatUnknownError(error)}`,
        )
      })
  }

  const onAdoptTextBlock: AdoptBlockHandler = (block, direction) => {
    const currentOld = textWorkflow.textOld
    const currentNew = textWorkflow.textNew

    const nextOld =
      direction === 'to-old' ? applyChangeBlockToOld(block, currentOld) : currentOld
    const nextNew =
      direction === 'to-new' ? applyChangeBlockToNew(block, currentNew) : currentNew

    if (nextOld === currentOld && nextNew === currentNew) {
      return
    }

    setTextAdoptUndoStack((prev) => [...prev, { oldText: currentOld, newText: currentNew }])
    setTextAdoptRedoStack([])

    textWorkflow.setTextOld(nextOld)
    textWorkflow.setTextNew(nextNew)

    void textWorkflow
      .runTextDiffWithValues({
        oldText: nextOld,
        newText: nextNew,
        oldSourcePath: textWorkflow.textOldSourcePath,
        newSourcePath: textWorkflow.textNewSourcePath,
      })
      .catch((error) => {
        showErrorNotification(
          'Failed to apply change',
          `Failed to re-compute diff: ${formatUnknownError(error)}`,
        )
      })

    showAdoptNotification(direction)
  }

  const onUndoTextAdopt = () => {
    if (textAdoptUndoStack.length === 0) {
      return
    }
    const snapshot = textAdoptUndoStack[textAdoptUndoStack.length - 1]
    setTextAdoptUndoStack((prev) => prev.slice(0, -1))
    setTextAdoptRedoStack((prev) => [
      ...prev,
      { oldText: textWorkflow.textOld, newText: textWorkflow.textNew },
    ])
    restoreTextAdoptSnapshot(snapshot)
  }

  const onRedoTextAdopt = () => {
    if (textAdoptRedoStack.length === 0) {
      return
    }
    const snapshot = textAdoptRedoStack[textAdoptRedoStack.length - 1]
    setTextAdoptRedoStack((prev) => prev.slice(0, -1))
    setTextAdoptUndoStack((prev) => [
      ...prev,
      { oldText: textWorkflow.textOld, newText: textWorkflow.textNew },
    ])
    restoreTextAdoptSnapshot(snapshot)
  }

  const onSaveText = useCallback(
    async (target: 'old' | 'new', options: { saveAs?: boolean } = {}) => {
      const ok = await textWorkflow.saveTextSide(target, options)
      if (ok) {
        setTextAdoptUndoStack([])
        setTextAdoptRedoStack([])
      }
      return ok
    },
    [textWorkflow.saveTextSide],
  )

  const saveAllRef = useRef<(saveAs: boolean) => void>(() => {})
  saveAllRef.current = (saveAs: boolean) => {
    if (mode !== 'text') {
      return
    }
    const hasOld = !!textWorkflow.textOld
    const hasNew = !!textWorkflow.textNew
    if (!hasOld && !hasNew) {
      return
    }
    void (async () => {
      let saved = false
      if (hasOld) {
        saved = (await onSaveText('old', { saveAs })) || saved
      }
      if (hasNew) {
        saved = (await onSaveText('new', { saveAs })) || saved
      }
      return saved
    })()
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const ctrlOrCmd = event.ctrlKey || event.metaKey
      if (!ctrlOrCmd || event.altKey) {
        return
      }
      if (event.key.toLowerCase() !== 's') {
        return
      }
      event.preventDefault()
      saveAllRef.current(event.shiftKey)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const main = (
    <DesktopMainContent
      mode={mode}
      showDirectoryReturnBanner={isDiffCentricMode && !!directoryChildDiffActions.directoryReturnContext}
      onReturnToDirectoryDiff={directoryChildDiffActions.returnToDirectoryDiff}
      textSourceProps={{
        oldSourcePath: textWorkflow.textOldSourcePath,
        newSourcePath: textWorkflow.textNewSourcePath,
        oldValue: textWorkflow.textOld,
        newValue: textWorkflow.textNew,
        oldEncoding: textWorkflow.textOldEncoding,
        newEncoding: textWorkflow.textNewEncoding,
        busy: textWorkflow.textEditorBusy,
        fileBusyTarget: textWorkflow.textFileBusyTarget,
        clipboardBusyTarget: textWorkflow.textClipboardBusyTarget,
        copyBusyTarget: textWorkflow.textPaneCopyBusyTarget,
        saveBusyTarget: textWorkflow.textSaveBusyTarget,
        onOpenFile: (target) => void textWorkflow.loadTextFromFile(target),
        onPasteClipboard: (target) => void textWorkflow.pasteTextFromClipboard(target),
        onCopyInput: (target) => void textWorkflow.copyTextInput(target),
        onClearInput: textWorkflow.clearTextInput,
        onSaveFile: (target, options) => void onSaveText(target, options),
        onEncodingChange: (target, encoding) =>
          void textWorkflow.reloadTextWithEncoding(target, encoding),
        onOldChange: textWorkflow.setTextOldInput,
        onNewChange: textWorkflow.setTextNewInput,
        onSwitchToJSON: (oldText, newText) => {
          jsonWorkflow.setJSONOldInput(oldText)
          jsonWorkflow.setJSONNewInput(newText)
          setMode('json')
        },
      }}
      textResultProps={{
        textResult: textWorkflow.textResult,
        textResultView: textViewState.textResultView,
        setTextResultView: textViewState.setTextResultView,
        textDiffLayout: textViewState.textDiffLayout,
        setTextDiffLayout: textViewState.setTextDiffLayout,
        textWrap: textViewState.textWrap,
        setTextWrap: textViewState.setTextWrap,
        textSearchQuery: textViewState.textSearchQuery,
        setTextSearchQuery: textViewState.setTextSearchQuery,
        textActiveSearchIndex: textViewState.textActiveSearchIndex,
        normalizedTextSearchQuery: textViewState.normalizedTextSearchQuery,
        textSearchMatches: textViewState.textSearchMatches,
        textRichRows: textViewState.textRichRows,
        textRichItems: textViewState.textRichItems,
        omittedSectionIds: textViewState.omittedSectionIds,
        allOmittedSectionsExpanded: textViewState.allOmittedSectionsExpanded,
        canRenderTextRich: textViewState.canRenderTextRich,
        textCopyBusy: textWorkflow.textCopyBusy,
        copyTextResultRawOutput: textWorkflow.copyTextResultRawOutput,
        moveTextSearch: textViewState.moveTextSearch,
        toggleAllTextUnchangedSections: textViewState.toggleAllTextUnchangedSections,
        getTextSectionExpansion: textViewState.getTextSectionExpansion,
        expandTextSection: textViewState.expandTextSection,
        registerTextSearchRowRef: textViewState.registerTextSearchRowRef,
        textDiffBlocks: textViewState.textDiffBlocks,
        textChangeBlocks: textViewState.textChangeBlocks,
        textActiveDiffIndex: textViewState.textActiveDiffIndex,
        activeTextDiffBlock: textViewState.activeTextDiffBlock,
        moveTextDiff: textViewState.moveTextDiff,
        onAdoptBlock: onAdoptTextBlock,
        canUndoAdopt: textAdoptUndoStack.length > 0,
        canRedoAdopt: textAdoptRedoStack.length > 0,
        onUndoAdopt: onUndoTextAdopt,
        onRedoAdopt: onRedoTextAdopt,
        ignoreWhitespace: textWorkflow.textCommon.ignoreWhitespace,
        onToggleIgnoreWhitespace: () =>
          textWorkflow.updateTextCommon(
            'ignoreWhitespace',
            !textWorkflow.textCommon.ignoreWhitespace,
          ),
      }}
      jsonSourceProps={{
        oldSourcePath: jsonWorkflow.jsonOldSourcePath,
        newSourcePath: jsonWorkflow.jsonNewSourcePath,
        oldValue: jsonWorkflow.jsonOldText,
        newValue: jsonWorkflow.jsonNewText,
        oldParseError: jsonWorkflow.jsonOldParseError,
        newParseError: jsonWorkflow.jsonNewParseError,
        busy: jsonWorkflow.jsonEditorBusy,
        fileBusyTarget: jsonWorkflow.jsonFileBusyTarget,
        clipboardBusyTarget: jsonWorkflow.jsonClipboardBusyTarget,
        copyBusyTarget: jsonWorkflow.jsonCopyBusyTarget,
        onOpenFile: (target) => void jsonWorkflow.loadJSONFromFile(target),
        onPasteClipboard: (target) => void jsonWorkflow.pasteJSONFromClipboard(target),
        onCopyInput: (target) => void jsonWorkflow.copyJSONInput(target),
        onClearInput: jsonWorkflow.clearJSONInput,
        onOldChange: jsonWorkflow.setJSONOldInput,
        onNewChange: jsonWorkflow.setJSONNewInput,
      }}
      jsonResultProps={{
        jsonResult: jsonViewState.jsonResult,
        jsonResultView: jsonViewState.jsonResultView,
        setJSONResultView: jsonViewState.setJSONResultView,
        textDiffLayout: textViewState.textDiffLayout,
        setTextDiffLayout: textViewState.setTextDiffLayout,
        textWrap: textViewState.textWrap,
        setTextWrap: textViewState.setTextWrap,
        jsonSearchQuery: jsonViewState.jsonSearchQuery,
        setJSONSearchQuery: jsonViewState.setJSONSearchQuery,
        jsonActiveSearchIndex: jsonViewState.jsonActiveSearchIndex,
        normalizedJSONSearchQuery: jsonViewState.normalizedJSONSearchQuery,
        jsonSearchMatches: jsonViewState.jsonSearchMatches,
        jsonDiffSearchMatches: jsonViewState.jsonDiffSearchMatches,
        jsonDiffSearchMatchIds: jsonViewState.jsonDiffSearchMatchIds,
        activeJSONDiffSearchMatchId: jsonViewState.activeJSONDiffSearchMatchId,
        canRenderJSONRich: jsonViewState.canRenderJSONRich,
        canRenderJSONDiff: jsonViewState.canRenderJSONDiff,
        jsonCopyBusy: jsonWorkflow.jsonCopyBusy,
        copyJSONResultRawOutput: jsonWorkflow.copyJSONResultRawOutput,
        moveJSONSearch: jsonViewState.moveJSONSearch,
        jsonDiffTextItems: jsonViewState.jsonDiffTextItems,
        jsonDiffRows: jsonViewState.jsonDiffRows,
        jsonSummary: jsonWorkflow.jsonRichResult?.summary,
        jsonDiffGroups: jsonViewState.jsonDiffGroups,
        effectiveJSONExpandedGroups: jsonViewState.effectiveJSONExpandedGroups,
        jsonSearchMatchIndexSet: jsonViewState.jsonSearchMatchIndexSet,
        jsonExpandedValueKeys: jsonViewState.jsonExpandedValueKeys,
        toggleJSONGroup: jsonViewState.toggleJSONGroup,
        toggleJSONExpandedValue: jsonViewState.toggleJSONExpandedValue,
        registerJSONDiffSearchRowRef: jsonViewState.registerJSONDiffSearchRowRef,
        jsonDiffNavCount: jsonViewState.jsonDiffNavCount,
        jsonActiveDiffIndex: jsonViewState.jsonActiveDiffIndex,
        activeJSONSemanticDiffIndex: jsonViewState.activeJSONSemanticDiffIndex,
        jsonDiffTextBlockIds: jsonViewState.jsonDiffTextBlockIds,
        activeJSONDiffTextBlockId: jsonViewState.activeJSONDiffTextBlockId,
        moveJSONDiff: jsonViewState.moveJSONDiff,
        registerJSONSemanticDiffRowRef: jsonViewState.registerJSONSemanticDiffRowRef,
      }}
      directoryResultProps={{
        directoryResult,
        directoryStatus,
        directoryLeftRoot,
        directoryRightRoot,
        directoryNameFilter,
        directoryCurrentPath,
        directoryViewMode: directoryViewState.directoryViewMode,
        directoryQuickFilter: directoryViewState.directoryQuickFilter,
        directoryQuickFilterCounts: directoryViewState.directoryQuickFilterCounts,
        directorySortKey: directoryViewState.directorySortKey,
        directorySortDirection: directoryViewState.directorySortDirection,
        directoryOpenBusyPath: directoryChildDiffActions.directoryOpenBusyPath,
        directoryTreeLoadingPath: directoryViewState.directoryTreeLoadingPath,
        selectedDirectoryItemPath: directoryViewState.selectedDirectoryItemPath,
        sortedDirectoryItems: directoryViewState.sortedDirectoryItems,
        flattenedDirectoryTreeRows: directoryViewState.flattenedDirectoryTreeRows,
        directoryBreadcrumbs: directoryViewState.directoryBreadcrumbs,
        loading,
        onBrowseDirectoryRoot: directoryWorkflow.browseDirectoryRoot,
        onSetDirectoryNameFilter: setDirectoryNameFilter,
        onSetDirectoryViewMode: directoryViewState.setDirectoryViewMode,
        onSetDirectoryQuickFilter: directoryViewState.setDirectoryQuickFilter,
        onSelectDirectoryItemPath: directoryViewState.setSelectedDirectoryItemPath,
        onNavigateDirectoryPath: directoryInteractions.navigateDirectoryPath,
        onApplyDirectorySort: directoryViewState.applyDirectorySort,
        onOpenDirectoryEntryDiff: directoryChildDiffActions.openDirectoryEntryDiff,
        onToggleDirectoryTreeNode: directoryViewState.toggleDirectoryTreeNode,
        onDirectoryRowDoubleClick: directoryInteractions.handleDirectoryRowDoubleClick,
        onDirectoryTreeRowDoubleClick: directoryInteractions.handleDirectoryTreeRowDoubleClick,
        onDirectoryTableKeyDown: (event) =>
          void directoryInteractions.handleDirectoryTableKeyDown(event),
        onDirectoryTreeKeyDown: (event) =>
          void directoryInteractions.handleDirectoryTreeKeyDown(event),
      }}
    />
  )

  const inspector = isDiffCentricMode ? (
    <div className="workspace-inspector-panel">
      <div className="workspace-inspector-header">
        <h3>{diffOptionsTitle}</h3>
        <Tooltip label="Close options">
          <ActionIcon
            variant="default"
            size={26}
            aria-label="Close options"
            onClick={onCloseDiffOptions}
          >
            <IconChevronDown size={14} />
          </ActionIcon>
        </Tooltip>
      </div>
      <div className="workspace-inspector-body">{diffOptionsContent}</div>
    </div>
  ) : undefined

  return {
    layoutMode:
      isDiffCentricMode || mode === 'directory'
        ? 'workspace'
        : 'sidebar',
    sidebar,
    main,
    inspector,
    inspectorOpen: isDiffCentricMode && diffOptionsOpened,
    isDirty: textAdoptUndoStack.length > 0,
  }
}
