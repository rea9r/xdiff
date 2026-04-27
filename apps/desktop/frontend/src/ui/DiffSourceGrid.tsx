import type { ReactNode } from 'react'

type DiffSourceGridProps = {
  left: ReactNode
  right: ReactNode
  className?: string
}

export function DiffSourceGrid({ left, right, className }: DiffSourceGridProps) {
  const gridClassName = ['diff-source-grid-shared', className].filter(Boolean).join(' ')

  return (
    <div className={gridClassName}>
      {left}
      {right}
    </div>
  )
}
