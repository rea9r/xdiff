import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TabBar } from '../TabBar'
import type { DesktopTab } from '../../useDesktopTabsManager'

const tabs: DesktopTab[] = [
  { id: 'tab-a', label: 'A' },
  { id: 'tab-b', label: 'B' },
  { id: 'tab-c', label: 'C' },
]

function renderTabBar(overrides: Partial<Parameters<typeof TabBar>[0]> = {}) {
  const onReorderTab = vi.fn()
  const onSelectTab = vi.fn()
  const result = render(
    <TabBar
      tabs={tabs}
      activeTabId="tab-a"
      onSelectTab={onSelectTab}
      onAddTab={vi.fn()}
      onCloseTab={vi.fn()}
      onReorderTab={onReorderTab}
      {...overrides}
    />,
  )
  return { ...result, onReorderTab, onSelectTab }
}

let pointTarget: Element | null = null

beforeEach(() => {
  pointTarget = null
  ;(document as unknown as { elementFromPoint: (x: number, y: number) => Element | null })
    .elementFromPoint = () => pointTarget
})

afterEach(() => {
  delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint
})

describe('TabBar drag reorder', () => {
  it('calls onReorderTab with source and target ids on pointer up over a different tab', () => {
    const { onReorderTab } = renderTabBar()

    const tabA = screen.getByText('A').closest('.xdiff-tab') as HTMLElement
    const tabC = screen.getByText('C').closest('.xdiff-tab') as HTMLElement

    fireEvent.pointerDown(tabA, { button: 0, clientX: 0, clientY: 0 })
    pointTarget = tabC
    fireEvent.pointerMove(window, { clientX: 100, clientY: 0 })
    fireEvent.pointerUp(window, { clientX: 100, clientY: 0 })

    expect(onReorderTab).toHaveBeenCalledWith('tab-a', 'tab-c')
  })

  it('does not call onReorderTab when pointer up happens on the source tab', () => {
    const { onReorderTab } = renderTabBar()

    const tabA = screen.getByText('A').closest('.xdiff-tab') as HTMLElement

    fireEvent.pointerDown(tabA, { button: 0, clientX: 0, clientY: 0 })
    pointTarget = tabA
    fireEvent.pointerMove(window, { clientX: 20, clientY: 0 })
    fireEvent.pointerUp(window, { clientX: 20, clientY: 0 })

    expect(onReorderTab).not.toHaveBeenCalled()
  })

  it('treats movement under threshold as a click and selects the tab', () => {
    const { onReorderTab, onSelectTab } = renderTabBar()

    const tabB = screen.getByText('B').closest('.xdiff-tab') as HTMLElement

    fireEvent.pointerDown(tabB, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 1, clientY: 1 })
    fireEvent.pointerUp(window, { clientX: 1, clientY: 1 })
    fireEvent.click(tabB)

    expect(onReorderTab).not.toHaveBeenCalled()
    expect(onSelectTab).toHaveBeenCalledWith('tab-b')
  })

  it('marks the dragged tab while dragging and the target while hovering', () => {
    renderTabBar()

    const tabA = screen.getByText('A').closest('.xdiff-tab') as HTMLElement
    const tabB = screen.getByText('B').closest('.xdiff-tab') as HTMLElement

    fireEvent.pointerDown(tabA, { button: 0, clientX: 0, clientY: 0 })
    pointTarget = tabB
    fireEvent.pointerMove(window, { clientX: 50, clientY: 0 })

    expect(tabA.className).toContain('is-dragging')
    expect(tabB.className).toContain('is-drag-over')

    fireEvent.pointerUp(window, { clientX: 50, clientY: 0 })

    expect(tabA.className).not.toContain('is-dragging')
    expect(tabB.className).not.toContain('is-drag-over')
  })

  it('suppresses the synthetic click that follows a drag', () => {
    const { onSelectTab } = renderTabBar()

    const tabA = screen.getByText('A').closest('.xdiff-tab') as HTMLElement
    const tabC = screen.getByText('C').closest('.xdiff-tab') as HTMLElement

    fireEvent.pointerDown(tabA, { button: 0, clientX: 0, clientY: 0 })
    pointTarget = tabC
    fireEvent.pointerMove(window, { clientX: 100, clientY: 0 })
    fireEvent.pointerUp(window, { clientX: 100, clientY: 0 })
    fireEvent.click(tabA)

    expect(onSelectTab).not.toHaveBeenCalled()
  })

  it('does not suppress later clicks on other tabs after a drag completes', async () => {
    const { onSelectTab } = renderTabBar()

    const tabA = screen.getByText('A').closest('.xdiff-tab') as HTMLElement
    const tabB = screen.getByText('B').closest('.xdiff-tab') as HTMLElement
    const tabC = screen.getByText('C').closest('.xdiff-tab') as HTMLElement

    fireEvent.pointerDown(tabA, { button: 0, clientX: 0, clientY: 0 })
    pointTarget = tabC
    fireEvent.pointerMove(window, { clientX: 100, clientY: 0 })
    fireEvent.pointerUp(window, { clientX: 100, clientY: 0 })

    await new Promise((resolve) => setTimeout(resolve, 0))

    fireEvent.click(tabB)
    expect(onSelectTab).toHaveBeenCalledWith('tab-b')
  })
})
