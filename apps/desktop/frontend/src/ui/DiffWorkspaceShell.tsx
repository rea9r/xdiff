import type { ReactNode } from 'react'

type DiffWorkspaceShellProps = {
  source: ReactNode
  result: ReactNode
  className?: string
}

export function DiffWorkspaceShell({
  source,
  result,
  className,
}: DiffWorkspaceShellProps) {
  const shellClassName = ['diff-workspace-shell', className].filter(Boolean).join(' ')

  return (
    <div className={shellClassName}>
      <div className="diff-workspace-source">{source}</div>
      <div className="diff-workspace-result">{result}</div>
    </div>
  )
}
