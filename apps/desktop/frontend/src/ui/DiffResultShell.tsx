import type { ReactNode } from 'react'
import { DiffStatusState } from './DiffStatusState'

type DiffResultShellProps = {
  toolbar: ReactNode
  summary?: ReactNode
  hasResult: boolean
  emptyState?: ReactNode
  children: ReactNode
  className?: string
}

export function DiffResultShell({
  toolbar,
  summary,
  hasResult,
  emptyState,
  children,
  className,
}: DiffResultShellProps) {
  const shellClassName = ['diff-result-shell', className].filter(Boolean).join(' ')

  return (
    <div className={shellClassName}>
      {toolbar}
      {summary}
      <div className="diff-result-body">
        {hasResult ? children : emptyState ?? <DiffStatusState kind="empty" />}
      </div>
    </div>
  )
}
