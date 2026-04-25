export type CompareStatusBadgeItem = {
  key: string
  label: string
  tone: 'added' | 'removed' | 'changed' | 'neutral' | 'error'
}

type CompareStatusBadgesProps = {
  items: CompareStatusBadgeItem[]
}

export function CompareStatusBadges({ items }: CompareStatusBadgesProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="compare-status-badges">
      {items.map((item) => (
        <span key={item.key} className={`compare-status-badge ${item.tone}`}>
          {item.label}
        </span>
      ))}
    </div>
  )
}
