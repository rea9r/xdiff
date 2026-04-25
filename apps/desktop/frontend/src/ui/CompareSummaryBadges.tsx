export type CompareSummaryBadgeItem = {
  key: string
  label: string
  tone: 'added' | 'removed' | 'changed' | 'neutral' | 'error'
}

type CompareSummaryBadgesProps = {
  items: CompareSummaryBadgeItem[]
}

export function CompareSummaryBadges({ items }: CompareSummaryBadgesProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="compare-summary-badges">
      {items.map((item) => (
        <span
          key={item.key}
          className={`compare-summary-badge ${item.tone}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  )
}
