export type DiffStatusBadgeItem = {
  key: string
  label: string
  tone: 'added' | 'removed' | 'changed' | 'neutral' | 'error'
}

type DiffStatusBadgesProps = {
  items: DiffStatusBadgeItem[]
}

export function DiffStatusBadges({ items }: DiffStatusBadgesProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="diff-status-badges">
      {items.map((item) => (
        <span key={item.key} className={`diff-status-badge ${item.tone}`}>
          {item.label}
        </span>
      ))}
    </div>
  )
}
