import type { ReactNode } from 'react'

type DiffStatusStateProps = {
  kind: 'empty' | 'success-empty' | 'error'
  children?: ReactNode
}

const defaultMessageByKind: Record<DiffStatusStateProps['kind'], string> = {
  empty: '(no result yet)',
  'success-empty': 'No differences',
  error: 'Execution error',
}

export function DiffStatusState({ kind, children }: DiffStatusStateProps) {
  const content = children ?? defaultMessageByKind[kind]
  return <div className={`diff-status-state ${kind}`}>{content}</div>
}
