import {
  IconBackspace,
  IconClipboardText,
  IconCopy,
  IconFolderOpen,
} from '@tabler/icons-react'
import { CompareCodeInputBody } from '../../ui/CompareCodeInputBody'
import { CompareSourceGrid } from '../../ui/CompareSourceGrid'
import { CompareSourcePane } from '../../ui/CompareSourcePane'
import {
  ComparePaneAction,
  ComparePaneActions,
} from '../../ui/CompareSourceActions'

type TextInputTarget = 'old' | 'new'

export type SpecCompareSourceWorkspaceProps = {
  oldSourcePath: string
  newSourcePath: string
  oldValue: string
  newValue: string
  oldLanguage: 'json' | 'yaml'
  newLanguage: 'json' | 'yaml'
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

export function SpecCompareSourceWorkspace({
  oldSourcePath,
  newSourcePath,
  oldValue,
  newValue,
  oldLanguage,
  newLanguage,
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
}: SpecCompareSourceWorkspaceProps) {
  return (
    <CompareSourceGrid
      left={
        <CompareSourcePane
          title="Old Spec"
          sourcePath={oldSourcePath}
          actions={
            <ComparePaneActions>
              <ComparePaneAction
                label="Open file into Old Spec"
                onClick={() => void onOpenFile('old')}
                disabled={busy}
                loading={fileBusyTarget === 'old'}
              >
                <IconFolderOpen size={14} />
              </ComparePaneAction>
              <ComparePaneAction
                label="Paste clipboard into Old Spec"
                onClick={() => void onPasteClipboard('old')}
                disabled={busy}
                loading={clipboardBusyTarget === 'old'}
              >
                <IconClipboardText size={14} />
              </ComparePaneAction>
              <ComparePaneAction
                label="Copy Old Spec"
                onClick={() => void onCopyInput('old')}
                disabled={busy || !oldValue}
                loading={copyBusyTarget === 'old'}
              >
                <IconCopy size={14} />
              </ComparePaneAction>
              <ComparePaneAction
                label="Clear Old Spec"
                onClick={() => onClearInput('old')}
                disabled={busy || !oldValue}
                danger
              >
                <IconBackspace size={14} />
              </ComparePaneAction>
            </ComparePaneActions>
          }
        >
          <CompareCodeInputBody
            value={oldValue}
            onChange={onOldChange}
            language={oldLanguage}
            parseError={oldParseError}
          />
        </CompareSourcePane>
      }
      right={
        <CompareSourcePane
          title="New Spec"
          sourcePath={newSourcePath}
          actions={
            <ComparePaneActions>
              <ComparePaneAction
                label="Open file into New Spec"
                onClick={() => void onOpenFile('new')}
                disabled={busy}
                loading={fileBusyTarget === 'new'}
              >
                <IconFolderOpen size={14} />
              </ComparePaneAction>
              <ComparePaneAction
                label="Paste clipboard into New Spec"
                onClick={() => void onPasteClipboard('new')}
                disabled={busy}
                loading={clipboardBusyTarget === 'new'}
              >
                <IconClipboardText size={14} />
              </ComparePaneAction>
              <ComparePaneAction
                label="Copy New Spec"
                onClick={() => void onCopyInput('new')}
                disabled={busy || !newValue}
                loading={copyBusyTarget === 'new'}
              >
                <IconCopy size={14} />
              </ComparePaneAction>
              <ComparePaneAction
                label="Clear New Spec"
                onClick={() => onClearInput('new')}
                disabled={busy || !newValue}
                danger
              >
                <IconBackspace size={14} />
              </ComparePaneAction>
            </ComparePaneActions>
          }
        >
          <CompareCodeInputBody
            value={newValue}
            onChange={onNewChange}
            language={newLanguage}
            parseError={newParseError}
          />
        </CompareSourcePane>
      }
    />
  )
}
