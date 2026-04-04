import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { RecentTargetsMenu } from '../RecentTargetsMenu'

function renderMenu() {
  return render(
    <MantineProvider>
      <RecentTargetsMenu
        buttonLabel="Recent history"
        items={[
          {
            key: 'a',
            label: 'old.json -> new.json',
            onClick: vi.fn(),
          },
        ]}
        onClear={vi.fn()}
      />
    </MantineProvider>,
  )
}

describe('RecentTargetsMenu', () => {
  it('opens menu when clicking history icon button', async () => {
    renderMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Recent history' }))

    expect(await screen.findByText('old.json -> new.json')).toBeInTheDocument()
  })

  it('closes menu when clicking outside', async () => {
    renderMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Recent history' }))
    expect(await screen.findByText('old.json -> new.json')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    fireEvent.click(document.body)

    await waitFor(() => {
      expect(screen.queryByText('old.json -> new.json')).toBeNull()
    })
  })
})
