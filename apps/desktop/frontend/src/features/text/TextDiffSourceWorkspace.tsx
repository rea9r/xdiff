import {
  IconBackspace,
  IconClipboardText,
  IconCopy,
  IconDeviceFloppy,
  IconFolderOpen,
  IconX,
} from '@tabler/icons-react'
import { DiffTextInputBody } from '../../ui/DiffTextInputBody'
import { DiffSourceGrid } from '../../ui/DiffSourceGrid'
import { DiffSourcePane } from '../../ui/DiffSourcePane'
import {
  DiffPaneAction,
  DiffPaneActions,
} from '../../ui/DiffSourceActions'
import { EncodingSelect } from '../../ui/EncodingSelect'
import type { TextEncoding } from '../../types'
import { useJSONSuggestion } from './useJSONSuggestion'

type TextInputTarget = 'old' | 'new'

export type TextDiffSourceWorkspaceProps = {
  oldSourcePath: string
  newSourcePath: string
  oldValue: string
  newValue: string
  oldEncoding: TextEncoding
  newEncoding: TextEncoding
  busy: boolean
  fileBusyTarget: TextInputTarget | null
  clipboardBusyTarget: TextInputTarget | null
  copyBusyTarget: TextInputTarget | null
  saveBusyTarget: TextInputTarget | null
  onOpenFile: (target: TextInputTarget) => void
  onPasteClipboard: (target: TextInputTarget) => void
  onCopyInput: (target: TextInputTarget) => void
  onClearInput: (target: TextInputTarget) => void
  onSaveFile: (target: TextInputTarget, options?: { saveAs?: boolean }) => void
  onEncodingChange: (target: TextInputTarget, encoding: TextEncoding) => void
  onOldChange: (value: string) => void
  onNewChange: (value: string) => void
  onSwitchToJSON: (oldValue: string, newValue: string) => void
}

export function TextDiffSourceWorkspace({
  oldSourcePath,
  newSourcePath,
  oldValue,
  newValue,
  oldEncoding,
  newEncoding,
  busy,
  fileBusyTarget,
  clipboardBusyTarget,
  copyBusyTarget,
  saveBusyTarget,
  onOpenFile,
  onPasteClipboard,
  onCopyInput,
  onClearInput,
  onSaveFile,
  onEncodingChange,
  onOldChange,
  onNewChange,
  onSwitchToJSON,
}: TextDiffSourceWorkspaceProps) {
  const jsonSuggestion = useJSONSuggestion(oldValue, newValue)

  return (
    <div className="text-diff-source-workspace">
      <DiffSourceGrid
        left={
          <DiffSourcePane
            title="Old text"
            sourcePath={oldSourcePath}
            dropTarget="text-old"
            actions={
              <DiffPaneActions>
                <EncodingSelect
                  value={oldEncoding}
                  onChange={(value) => onEncodingChange('old', value)}
                  disabled={busy}
                  ariaLabel="Old file encoding"
                />
                <DiffPaneAction
                  label="Open file into Old text"
                  onClick={() => void onOpenFile('old')}
                  disabled={busy}
                  loading={fileBusyTarget === 'old'}
                >
                  <IconFolderOpen size={14} />
                </DiffPaneAction>
                <DiffPaneAction
                  label={
                    oldSourcePath
                      ? 'Save Old text (Shift: Save As)'
                      : 'Save Old text as…'
                  }
                  onClick={(event) =>
                    void onSaveFile('old', { saveAs: event.shiftKey || !oldSourcePath })
                  }
                  disabled={busy || !oldValue}
                  loading={saveBusyTarget === 'old'}
                >
                  <IconDeviceFloppy size={14} />
                </DiffPaneAction>
                <DiffPaneAction
                  label="Paste clipboard into Old text"
                  onClick={() => void onPasteClipboard('old')}
                  disabled={busy}
                  loading={clipboardBusyTarget === 'old'}
                >
                  <IconClipboardText size={14} />
                </DiffPaneAction>
                <DiffPaneAction
                  label="Copy Old text"
                  onClick={() => void onCopyInput('old')}
                  disabled={busy || !oldValue}
                  loading={copyBusyTarget === 'old'}
                >
                  <IconCopy size={14} />
                </DiffPaneAction>
                <DiffPaneAction
                  label="Clear Old text"
                  onClick={() => onClearInput('old')}
                  disabled={busy || !oldValue}
                  danger
                >
                  <IconBackspace size={14} />
                </DiffPaneAction>
              </DiffPaneActions>
            }
          >
            <DiffTextInputBody value={oldValue} onChange={onOldChange} />
          </DiffSourcePane>
        }
        right={
          <DiffSourcePane
            title="New text"
            sourcePath={newSourcePath}
            dropTarget="text-new"
            actions={
              <DiffPaneActions>
                <EncodingSelect
                  value={newEncoding}
                  onChange={(value) => onEncodingChange('new', value)}
                  disabled={busy}
                  ariaLabel="New file encoding"
                />
                <DiffPaneAction
                  label="Open file into New text"
                  onClick={() => void onOpenFile('new')}
                  disabled={busy}
                  loading={fileBusyTarget === 'new'}
                >
                  <IconFolderOpen size={14} />
                </DiffPaneAction>
                <DiffPaneAction
                  label={
                    newSourcePath
                      ? 'Save New text (Shift: Save As)'
                      : 'Save New text as…'
                  }
                  onClick={(event) =>
                    void onSaveFile('new', { saveAs: event.shiftKey || !newSourcePath })
                  }
                  disabled={busy || !newValue}
                  loading={saveBusyTarget === 'new'}
                >
                  <IconDeviceFloppy size={14} />
                </DiffPaneAction>
                <DiffPaneAction
                  label="Paste clipboard into New text"
                  onClick={() => void onPasteClipboard('new')}
                  disabled={busy}
                  loading={clipboardBusyTarget === 'new'}
                >
                  <IconClipboardText size={14} />
                </DiffPaneAction>
                <DiffPaneAction
                  label="Copy New text"
                  onClick={() => void onCopyInput('new')}
                  disabled={busy || !newValue}
                  loading={copyBusyTarget === 'new'}
                >
                  <IconCopy size={14} />
                </DiffPaneAction>
                <DiffPaneAction
                  label="Clear New text"
                  onClick={() => onClearInput('new')}
                  disabled={busy || !newValue}
                  danger
                >
                  <IconBackspace size={14} />
                </DiffPaneAction>
              </DiffPaneActions>
            }
          >
            <DiffTextInputBody value={newValue} onChange={onNewChange} />
          </DiffSourcePane>
        }
      />
      {jsonSuggestion.shouldShow ? (
        <div className="text-json-suggestion" role="status">
          <span className="text-json-suggestion-label">
            Looks like JSON.
          </span>
          <button
            type="button"
            className="text-json-suggestion-action"
            onClick={() => onSwitchToJSON(oldValue, newValue)}
          >
            Switch to JSON diff
          </button>
          <button
            type="button"
            className="text-json-suggestion-dismiss"
            aria-label="Dismiss JSON diff suggestion"
            onClick={jsonSuggestion.dismiss}
          >
            <IconX size={12} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
