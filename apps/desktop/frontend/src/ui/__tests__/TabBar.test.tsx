import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MantineProvider } from '@mantine/core'
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
  const onCloseOthers = vi.fn()
  const onCloseToRight = vi.fn()
  const onCloseAll = vi.fn()
  const result = render(
    <MantineProvider>
      <TabBar
        tabs={tabs}
        activeTabId="tab-a"
        onSelectTab={onSelectTab}
        onAddTab={vi.fn()}
        onCloseTab={vi.fn()}
        onCloseOthers={onCloseOthers}
        onCloseToRight={onCloseToRight}
        onCloseAll={onCloseAll}
        onReorderTab={onReorderTab}
        {...overrides}
      />
    </MantineProvider>,
  )
  return { ...result, onReorderTab, onSelectTab, onCloseOthers, onCloseToRight, onCloseAll }
}

let pointTarget: Element | null = null

beforeEach(() => {
  pointTarget = null
  ;(document as unknown as { elementFromPoint: (x: number, y: number) => Element | null })
    .elementFromPoint = () => pointTarget
  ;(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {}
})

afterEach(() => {
  delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint
  delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView
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

describe('TabBar add affordances', () => {
  it('adds a tab when the empty area of the scroll container is double-clicked', () => {
    const onAddTab = vi.fn()
    const { container } = renderTabBar({ onAddTab })
    const scroll = container.querySelector('.xdiff-tab-bar-scroll') as HTMLElement

    fireEvent.mouseDown(scroll, { button: 0 })
    fireEvent.mouseDown(scroll, { button: 0 })

    expect(onAddTab).toHaveBeenCalledTimes(1)
  })

  it('does not add a tab on a single click of the empty area', () => {
    const onAddTab = vi.fn()
    const { container } = renderTabBar({ onAddTab })
    const scroll = container.querySelector('.xdiff-tab-bar-scroll') as HTMLElement

    fireEvent.mouseDown(scroll, { button: 0 })

    expect(onAddTab).not.toHaveBeenCalled()
  })

  it('does not add a tab when a tab itself is double-clicked', () => {
    const onAddTab = vi.fn()
    const { container } = renderTabBar({ onAddTab })
    const tabA = container.querySelector('[data-tab-id="tab-a"]') as HTMLElement

    fireEvent.mouseDown(tabA, { button: 0 })
    fireEvent.mouseDown(tabA, { button: 0 })

    expect(onAddTab).not.toHaveBeenCalled()
  })
})

describe('TabBar middle-click close', () => {
  it('closes the tab on middle-click when more than one tab exists', () => {
    const onCloseTab = vi.fn()
    const { container } = renderTabBar({ onCloseTab })
    const tabB = container.querySelector('[data-tab-id="tab-b"]') as HTMLElement

    fireEvent(tabB, new MouseEvent('auxclick', { bubbles: true, button: 1 }))

    expect(onCloseTab).toHaveBeenCalledWith('tab-b')
  })

  it('ignores middle-click when only one tab remains', () => {
    const onCloseTab = vi.fn()
    const onlyOne: DesktopTab[] = [{ id: 'tab-only', label: 'Only' }]
    const { container } = renderTabBar({ tabs: onlyOne, activeTabId: 'tab-only', onCloseTab })
    const tab = container.querySelector('[data-tab-id="tab-only"]') as HTMLElement

    fireEvent(tab, new MouseEvent('auxclick', { bubbles: true, button: 1 }))

    expect(onCloseTab).not.toHaveBeenCalled()
  })

  it('does not close on left or right auxclick', () => {
    const onCloseTab = vi.fn()
    const { container } = renderTabBar({ onCloseTab })
    const tabB = container.querySelector('[data-tab-id="tab-b"]') as HTMLElement

    fireEvent(tabB, new MouseEvent('auxclick', { bubbles: true, button: 2 }))
    fireEvent(tabB, new MouseEvent('auxclick', { bubbles: true, button: 0 }))

    expect(onCloseTab).not.toHaveBeenCalled()
  })
})

describe('TabBar context menu', () => {
  it('invokes onCloseOthers with the right tab id', async () => {
    const { onCloseOthers, container } = renderTabBar()
    const tabB = container.querySelector('[data-tab-id="tab-b"]') as HTMLElement

    fireEvent.contextMenu(tabB, { clientX: 10, clientY: 10 })
    fireEvent.click(await screen.findByRole('menuitem', { name: /close others/i }))

    expect(onCloseOthers).toHaveBeenCalledWith('tab-b')
  })

  it('invokes onCloseToRight with the right tab id', async () => {
    const { onCloseToRight, container } = renderTabBar()
    const tabA = container.querySelector('[data-tab-id="tab-a"]') as HTMLElement

    fireEvent.contextMenu(tabA, { clientX: 0, clientY: 0 })
    fireEvent.click(await screen.findByRole('menuitem', { name: /close to the right/i }))

    expect(onCloseToRight).toHaveBeenCalledWith('tab-a')
  })

  it('disables Close to the right on the rightmost tab', async () => {
    const { onCloseToRight, container } = renderTabBar()
    const tabC = container.querySelector('[data-tab-id="tab-c"]') as HTMLElement

    fireEvent.contextMenu(tabC, { clientX: 0, clientY: 0 })
    const item = await screen.findByRole('menuitem', { name: /close to the right/i })
    fireEvent.click(item)

    expect(item).toHaveAttribute('data-disabled')
    expect(onCloseToRight).not.toHaveBeenCalled()
  })

  it('invokes onCloseAll', async () => {
    const { onCloseAll, container } = renderTabBar()
    const tabA = container.querySelector('[data-tab-id="tab-a"]') as HTMLElement

    fireEvent.contextMenu(tabA, { clientX: 0, clientY: 0 })
    fireEvent.click(await screen.findByRole('menuitem', { name: /close all/i }))

    expect(onCloseAll).toHaveBeenCalled()
  })

  it('disables Close others when only one tab exists', async () => {
    const onlyOne: DesktopTab[] = [{ id: 'tab-only', label: 'Only' }]
    const { onCloseOthers, container } = renderTabBar({ tabs: onlyOne, activeTabId: 'tab-only' })
    const tab = container.querySelector('[data-tab-id="tab-only"]') as HTMLElement

    fireEvent.contextMenu(tab, { clientX: 0, clientY: 0 })
    const item = await screen.findByRole('menuitem', { name: /close others/i })
    fireEvent.click(item)

    expect(item).toHaveAttribute('data-disabled')
    expect(onCloseOthers).not.toHaveBeenCalled()
  })
})
