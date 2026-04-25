import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { ScenarioResultPanel } from '../ScenarioResultPanel'
import type { ScenarioRunResponse } from '../../../types'

const runResult: ScenarioRunResponse = {
  exitCode: 1,
  summary: {
    total: 2,
    ok: 1,
    diff: 0,
    error: 1,
    exitCode: 1,
  },
  results: [
    { name: 'check-ok', kind: 'json', status: 'ok', exitCode: 0, diffFound: false },
    { name: 'check-error', kind: 'text', status: 'error', exitCode: 2, diffFound: false },
  ],
}

describe('ScenarioResultPanel', () => {
  function renderPanel(
    scenarioRunResult: ScenarioRunResponse | null = runResult,
    selectedScenarioResultName = '',
  ) {
    const setSelectedScenarioResultName = vi.fn()
    const view = render(
      <MantineProvider>
        <ScenarioResultPanel
          scenarioRunResult={scenarioRunResult}
          selectedScenarioResultName={selectedScenarioResultName}
          setSelectedScenarioResultName={setSelectedScenarioResultName}
        />
      </MantineProvider>,
    )
    return { ...view, setSelectedScenarioResultName }
  }

  it('renders toolbar with status filter and search controls', () => {
    renderPanel()

    expect(screen.getByText('Scenario results')).toBeInTheDocument()
    expect(screen.getByDisplayValue('all statuses')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search scenario results')).toBeInTheDocument()
  })

  it('filters results by selected status', () => {
    renderPanel()

    fireEvent.change(screen.getByDisplayValue('all statuses'), {
      target: { value: 'error' },
    })

    expect(screen.queryByText('check-ok')).toBeNull()
    expect(screen.queryByText('check-diff')).toBeNull()
    expect(screen.getAllByText('check-error').length).toBeGreaterThan(0)
  })

  it('supports keyboard selection on results list', () => {
    const { setSelectedScenarioResultName } = renderPanel()
    const list = screen.getByRole('listbox', { name: 'Scenario results list' })

    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'End' })
    fireEvent.keyDown(list, { key: 'Home' })

    expect(setSelectedScenarioResultName).toHaveBeenNthCalledWith(1, 'check-ok')
    expect(setSelectedScenarioResultName).toHaveBeenNthCalledWith(2, 'check-error')
    expect(setSelectedScenarioResultName).toHaveBeenNthCalledWith(3, 'check-ok')
  })

  it('shows empty state when current status filter has no matches', () => {
    const okOnlyResult: ScenarioRunResponse = {
      ...runResult,
      summary: {
        total: 1,
        ok: 1,
        diff: 0,
        error: 0,
        exitCode: 0,
      },
      results: [{ name: 'check-only-ok', kind: 'json', status: 'ok', exitCode: 0, diffFound: false }],
    }
    renderPanel(okOnlyResult)

    fireEvent.change(screen.getByDisplayValue('all statuses'), {
      target: { value: 'error' },
    })

    expect(screen.getByText('(no results for current filter)')).toBeInTheDocument()
    expect(screen.getByText('(no selected result)')).toBeInTheDocument()
  })
})
