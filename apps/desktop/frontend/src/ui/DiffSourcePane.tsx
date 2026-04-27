import type { ReactNode } from 'react'
import { DiffPathSlot } from './DiffPathSlot'

type DiffSourcePaneProps = {
  title: string
  sourcePath?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  dropTarget?: string
}

export function DiffSourcePane({
  title,
  sourcePath,
  actions,
  children,
  className,
  dropTarget,
}: DiffSourcePaneProps) {
  const paneClassName = [
    'diff-source-pane',
    dropTarget ? 'diff-source-pane--droppable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={paneClassName} data-drop-target={dropTarget}>
      <div className="diff-source-pane-header">
        <div className="diff-source-pane-title">
          <label className="field-label">{title}</label>
          <DiffPathSlot path={sourcePath} />
        </div>
        {actions ? <div className="diff-source-pane-actions">{actions}</div> : null}
      </div>

      <div className="diff-source-pane-body">{children}</div>
    </div>
  )
}
