import {
  IconBackspace,
  IconClipboardText,
  IconCopy,
  IconFolderOpen,
} from '@tabler/icons-react'
import { DiffCodeInputBody } from '../../ui/DiffCodeInputBody'
import { DiffSourceGrid } from '../../ui/DiffSourceGrid'
import { DiffSourcePane } from '../../ui/DiffSourcePane'
import {
  DiffPaneAction,
  DiffPaneActions,
} from '../../ui/DiffSourceActions'

type TextInputTarget = 'old' | 'new'

export type JSONDiffSourceWorkspaceProps = {
  oldSourcePath: string
  newSourcePath: string
  oldValue: string
  newValue: string
  oldParseError: string | null
  newParseError: string | null
  busy: boolean
  fileBusyTarget: TextInputTarget | null
  clipboardBusyTarget: TextInputTarget | null
  copyBusyTarget: TextInputTarget | null
  onOpenFile: (target: TextInputTarget) => void
  onPasteClipboard: (target: TextInputTarget) => void
  onCopyInput: (target: TextInputTarget) => void
  onClearInput: (target: TextInputTarget) => void
  onOldChange: (value: string) => void
  onNewChange: (value: string) => void
}

export function JSONDiffSourceWorkspace({
  oldSourcePath,
  newSourcePath,
  oldValue,
  newValue,
  oldParseError,
  newParseError,
  busy,
  fileBusyTarget,
  clipboardBusyTarget,
  copyBusyTarget,
  onOpenFile,
  onPasteClipboard,
  onCopyInput,
  onClearInput,
  onOldChange,
  onNewChange,
}: JSONDiffSourceWorkspaceProps) {
  return (
    <DiffSourceGrid
      left={
        <DiffSourcePane
          title="Old JSON"
          sourcePath={oldSourcePath}
          dropTarget="json-old"
          actions={
            <DiffPaneActions>
              <DiffPaneAction
                label="Open file into Old JSON"
                onClick={() => void onOpenFile('old')}
                disabled={busy}
                loading={fileBusyTarget === 'old'}
              >
                <IconFolderOpen size={14} />
              </DiffPaneAction>
              <DiffPaneAction
                label="Paste clipboard into Old JSON"
                onClick={() => void onPasteClipboard('old')}
                disabled={busy}
                loading={clipboardBusyTarget === 'old'}
              >
                <IconClipboardText size={14} />
              </DiffPaneAction>
              <DiffPaneAction
                label="Copy Old JSON"
                onClick={() => void onCopyInput('old')}
                disabled={busy || !oldValue}
                loading={copyBusyTarget === 'old'}
              >
                <IconCopy size={14} />
              </DiffPaneAction>
              <DiffPaneAction
                label="Clear Old JSON"
                onClick={() => onClearInput('old')}
                disabled={busy || !oldValue}
                danger
              >
                <IconBackspace size={14} />
              </DiffPaneAction>
            </DiffPaneActions>
          }
        >
          <DiffCodeInputBody
            value={oldValue}
            onChange={onOldChange}
            parseError={oldParseError}
          />
        </DiffSourcePane>
      }
      right={
        <DiffSourcePane
          title="New JSON"
          sourcePath={newSourcePath}
          dropTarget="json-new"
          actions={
            <DiffPaneActions>
              <DiffPaneAction
                label="Open file into New JSON"
                onClick={() => void onOpenFile('new')}
                disabled={busy}
                loading={fileBusyTarget === 'new'}
              >
                <IconFolderOpen size={14} />
              </DiffPaneAction>
              <DiffPaneAction
                label="Paste clipboard into New JSON"
                onClick={() => void onPasteClipboard('new')}
                disabled={busy}
                loading={clipboardBusyTarget === 'new'}
              >
                <IconClipboardText size={14} />
              </DiffPaneAction>
              <DiffPaneAction
                label="Copy New JSON"
                onClick={() => void onCopyInput('new')}
                disabled={busy || !newValue}
                loading={copyBusyTarget === 'new'}
              >
                <IconCopy size={14} />
              </DiffPaneAction>
              <DiffPaneAction
                label="Clear New JSON"
                onClick={() => onClearInput('new')}
                disabled={busy || !newValue}
                danger
              >
                <IconBackspace size={14} />
              </DiffPaneAction>
            </DiffPaneActions>
          }
        >
          <DiffCodeInputBody
            value={newValue}
            onChange={onNewChange}
            parseError={newParseError}
          />
        </DiffSourcePane>
      }
    />
  )
}
