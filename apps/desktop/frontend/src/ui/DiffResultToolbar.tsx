import type { ReactNode } from 'react'

type DiffResultToolbarProps = {
  primary: ReactNode
  summary?: ReactNode
  secondary?: ReactNode
}

export function DiffResultToolbar({
  primary,
  summary,
  secondary,
}: DiffResultToolbarProps) {
  return (
    <div className="diff-result-toolbar">
      <div className="diff-result-primary">
        {primary}
        {summary}
      </div>
      {secondary ? <div className="diff-result-secondary">{secondary}</div> : null}
    </div>
  )
}
