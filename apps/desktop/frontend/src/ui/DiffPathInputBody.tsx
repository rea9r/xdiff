import { IconBackspace, IconFolderOpen } from '@tabler/icons-react'
import { DiffPaneAction, DiffPaneActions } from './DiffSourceActions'

type DiffPathInputBodyProps = {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onBrowse?: () => void
  onClear?: () => void
  browseDisabled?: boolean
  clearDisabled?: boolean
  browseLabel?: string
  clearLabel?: string
}

export function DiffPathInputBody({
  value,
  placeholder,
  onChange,
  onBrowse,
  onClear,
  browseDisabled = false,
  clearDisabled = false,
  browseLabel = 'Browse file',
  clearLabel = 'Clear path',
}: DiffPathInputBodyProps) {
  return (
    <div className="diff-path-input-body">
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <DiffPaneActions>
        <DiffPaneAction
          label={browseLabel}
          onClick={onBrowse}
          disabled={!onBrowse || browseDisabled}
        >
          <IconFolderOpen size={14} />
        </DiffPaneAction>
        <DiffPaneAction
          label={clearLabel}
          onClick={onClear}
          disabled={!onClear || clearDisabled}
          danger
        >
          <IconBackspace size={14} />
        </DiffPaneAction>
      </DiffPaneActions>
    </div>
  )
}
