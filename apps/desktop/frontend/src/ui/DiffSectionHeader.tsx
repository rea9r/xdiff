import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import type { ReactNode } from 'react'

type DiffSectionHeaderProps = {
  title: ReactNode
  countLabel?: string
  badges?: ReactNode
  collapsed?: boolean
  onToggle?: () => void
  actions?: ReactNode
}

export function DiffSectionHeader({
  title,
  countLabel,
  badges,
  collapsed = false,
  onToggle,
  actions,
}: DiffSectionHeaderProps) {
  const Content = (
    <>
      <span className="diff-section-header-left">
        {onToggle ? (
          collapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />
        ) : null}
        <span className="diff-section-title">{title}</span>
        {countLabel ? <span className="diff-section-count">{countLabel}</span> : null}
      </span>
      <span className="diff-section-header-right">
        {badges}
        {actions}
      </span>
    </>
  )

  if (onToggle) {
    return (
      <button type="button" className="diff-section-header" onClick={onToggle}>
        {Content}
      </button>
    )
  }

  return <div className="diff-section-header">{Content}</div>
}
