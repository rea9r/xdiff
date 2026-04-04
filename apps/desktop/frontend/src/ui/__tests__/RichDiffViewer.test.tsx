import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RichDiffViewer } from '../RichDiffViewer'
import type { RichDiffItem } from '../../features/text/textDiff'

function makeItems(count: number): RichDiffItem[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'row' as const,
    row: {
      kind: 'context' as const,
      oldLine: index + 1,
      newLine: index + 1,
      content: `line ${index + 1}`,
    },
  }))
}

describe('RichDiffViewer', () => {
  it('renders incrementally and can show more rows', () => {
    const items = makeItems(5)
    const { container, getByRole } = render(
      <RichDiffViewer
        items={items}
        layout="unified"
        keyPrefix="test"
        initialVisibleItems={2}
      />,
    )

    expect(container.querySelectorAll('.text-diff-row')).toHaveLength(2)

    fireEvent.click(getByRole('button', { name: /show more/i }))

    expect(container.querySelectorAll('.text-diff-row')).toHaveLength(4)
  })

  it('renders all rows when search matches are present', () => {
    const items = makeItems(5)
    const { container } = render(
      <RichDiffViewer
        items={items}
        layout="unified"
        keyPrefix="test-search"
        initialVisibleItems={2}
        searchMatchIds={new Set(['any'])}
      />,
    )

    expect(container.querySelectorAll('.text-diff-row')).toHaveLength(5)
  })
})
