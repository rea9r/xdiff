import type { ReactNode } from 'react'

type DiffValueBlockProps = {
  inline?: boolean
  expanded?: boolean
  children: ReactNode
}

export function DiffValueBlock({ inline = false, expanded = false, children }: DiffValueBlockProps) {
  if (inline) {
    return (
      <span className="diff-value-inline-shell">
        <code className="diff-value-inline">{children}</code>
      </span>
    )
  }

  return (
    <pre className={`diff-value-block ${expanded ? 'is-expanded' : ''}`}>
      {children}
    </pre>
  )
}
