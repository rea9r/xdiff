import type { ReactNode } from 'react'
import { CompareStatusState } from './CompareStatusState'

type CompareResultShellProps = {
  toolbar: ReactNode
  summary?: ReactNode
  hasResult: boolean
  emptyState?: ReactNode
  children: ReactNode
  className?: string
}

export function CompareResultShell({
  toolbar,
  summary,
  hasResult,
  emptyState,
  children,
  className,
}: CompareResultShellProps) {
  const shellClassName = ['compare-result-shell', className].filter(Boolean).join(' ')

  return (
    <div className={shellClassName}>
      {toolbar}
      {summary}
      <div className="compare-result-body">
        {hasResult ? children : emptyState ?? <CompareStatusState kind="empty" />}
      </div>
    </div>
  )
}
