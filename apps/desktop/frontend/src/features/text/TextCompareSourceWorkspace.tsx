import {
  IconBackspace,
  IconClipboardText,
  IconCopy,
  IconFolderOpen,
  IconX,
} from '@tabler/icons-react'
import { CompareTextInputBody } from '../../ui/CompareTextInputBody'
import { CompareSourceGrid } from '../../ui/CompareSourceGrid'
import { CompareSourcePane } from '../../ui/CompareSourcePane'
import {
  ComparePaneAction,
  ComparePaneActions,
} from '../../ui/CompareSourceActions'
import { useJSONSuggestion } from './useJSONSuggestion'

type TextInputTarget = 'old' | 'new'

export type TextCompareSourceWorkspaceProps = {
  oldSourcePath: string
  newSourcePath: string
  oldValue: string
  newValue: string
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
  onSwitchToJSON: (oldValue: string, newValue: string) => void
}

export function TextCompareSourceWorkspace({
  oldSourcePath,
  newSourcePath,
  oldValue,
  newValue,
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
  onSwitchToJSON,
}: TextCompareSourceWorkspaceProps) {
  const jsonSuggestion = useJSONSuggestion(oldValue, newValue)

  return (
    <div className="text-compare-source-workspace">
      <CompareSourceGrid
        left={
          <CompareSourcePane
            title="Old text"
            sourcePath={oldSourcePath}
            actions={
              <ComparePaneActions>
                <ComparePaneAction
                  label="Open file into Old text"
                  onClick={() => void onOpenFile('old')}
                  disabled={busy}
                  loading={fileBusyTarget === 'old'}
                >
                  <IconFolderOpen size={14} />
                </ComparePaneAction>
                <ComparePaneAction
                  label="Paste clipboard into Old text"
                  onClick={() => void onPasteClipboard('old')}
                  disabled={busy}
                  loading={clipboardBusyTarget === 'old'}
                >
                  <IconClipboardText size={14} />
                </ComparePaneAction>
                <ComparePaneAction
                  label="Copy Old text"
                  onClick={() => void onCopyInput('old')}
                  disabled={busy || !oldValue}
                  loading={copyBusyTarget === 'old'}
                >
                  <IconCopy size={14} />
                </ComparePaneAction>
                <ComparePaneAction
                  label="Clear Old text"
                  onClick={() => onClearInput('old')}
                  disabled={busy || !oldValue}
                  danger
                >
                  <IconBackspace size={14} />
                </ComparePaneAction>
              </ComparePaneActions>
            }
          >
            <CompareTextInputBody value={oldValue} onChange={onOldChange} />
          </CompareSourcePane>
        }
        right={
          <CompareSourcePane
            title="New text"
            sourcePath={newSourcePath}
            actions={
              <ComparePaneActions>
                <ComparePaneAction
                  label="Open file into New text"
                  onClick={() => void onOpenFile('new')}
                  disabled={busy}
                  loading={fileBusyTarget === 'new'}
                >
                  <IconFolderOpen size={14} />
                </ComparePaneAction>
                <ComparePaneAction
                  label="Paste clipboard into New text"
                  onClick={() => void onPasteClipboard('new')}
                  disabled={busy}
                  loading={clipboardBusyTarget === 'new'}
                >
                  <IconClipboardText size={14} />
                </ComparePaneAction>
                <ComparePaneAction
                  label="Copy New text"
                  onClick={() => void onCopyInput('new')}
                  disabled={busy || !newValue}
                  loading={copyBusyTarget === 'new'}
                >
                  <IconCopy size={14} />
                </ComparePaneAction>
                <ComparePaneAction
                  label="Clear New text"
                  onClick={() => onClearInput('new')}
                  disabled={busy || !newValue}
                  danger
                >
                  <IconBackspace size={14} />
                </ComparePaneAction>
              </ComparePaneActions>
            }
          >
            <CompareTextInputBody value={newValue} onChange={onNewChange} />
          </CompareSourcePane>
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
            Switch to JSON compare
          </button>
          <button
            type="button"
            className="text-json-suggestion-dismiss"
            aria-label="Dismiss JSON compare suggestion"
            onClick={jsonSuggestion.dismiss}
          >
            <IconX size={12} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
