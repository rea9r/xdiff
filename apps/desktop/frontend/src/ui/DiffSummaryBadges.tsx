export type DiffSummaryBadgeItem = {
  key: string
  label: string
  tone: 'added' | 'removed' | 'changed' | 'neutral' | 'error'
}

type DiffSummaryBadgesProps = {
  items: DiffSummaryBadgeItem[]
}

export function DiffSummaryBadges({ items }: DiffSummaryBadgesProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="diff-summary-badges">
      {items.map((item) => (
        <span
          key={item.key}
          className={`diff-summary-badge ${item.tone}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  )
}
