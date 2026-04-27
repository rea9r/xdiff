type DiffPathSlotProps = {
  path?: string
  title?: string
}

export function DiffPathSlot({ path, title }: DiffPathSlotProps) {
  const text = path ?? ''
  const tooltip = title ?? text

  return (
    <div className="diff-path-slot">
      {text ? (
        <div className="muted diff-path-slot-text" title={tooltip}>
          {text}
        </div>
      ) : (
        <div className="diff-path-slot-text diff-path-slot-empty" aria-hidden="true" />
      )}
    </div>
  )
}
