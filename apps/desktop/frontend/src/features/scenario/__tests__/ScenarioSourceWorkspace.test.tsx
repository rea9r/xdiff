import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { ScenarioSourceWorkspace } from '../ScenarioSourceWorkspace'
import type { ScenarioSourceWorkspaceProps } from '../ScenarioSourceWorkspace'

const baseProps: ScenarioSourceWorkspaceProps = {
  scenarioPath: '/tmp/scenario.yaml',
  onScenarioPathChange: vi.fn(),
  onBrowseScenario: vi.fn(),
  scenarioRecentPaths: [],
  onLoadRecentScenario: vi.fn(),
  onClearRecentScenarios: vi.fn(),
  reportFormat: 'text',
  onReportFormatChange: vi.fn(),
  loading: false,
  onLoadChecks: vi.fn(),
  onRun: vi.fn(),
  scenarioListStatus: '',
  scenarioChecks: [
    { name: 'check-json-ok', kind: 'json', old: 'a', new: 'b', summary: 'json summary' },
    { name: 'check-spec-diff', kind: 'spec', old: 'a', new: 'b', summary: 'spec summary' },
    { name: 'check-text-error', kind: 'text', old: 'a', new: 'b', summary: 'error summary' },
  ],
  selectedChecks: ['check-json-ok'],
  onToggleCheck: vi.fn(),
  onSelectAllChecks: vi.fn(),
  onClearCheckSelection: vi.fn(),
}

describe('ScenarioSourceWorkspace', () => {
  function renderWorkspace(overrideProps: Partial<ScenarioSourceWorkspaceProps> = {}) {
    return render(
      <MantineProvider>
        <ScenarioSourceWorkspace {...baseProps} {...overrideProps} />
      </MantineProvider>,
    )
  }

  it('shows selected count when search is empty', () => {
    renderWorkspace()

    expect(screen.getByText('1 selected / 3')).toBeInTheDocument()
  })

  it('filters checks by search query', () => {
    renderWorkspace()

    fireEvent.change(screen.getByPlaceholderText('Search checks'), {
      target: { value: 'spec' },
    })

    expect(screen.queryByText('check-json-ok')).toBeNull()
    expect(screen.getByText('check-spec-diff')).toBeInTheDocument()
    expect(screen.queryByText('check-text-error')).toBeNull()
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
  })

  it('shows empty state when no checks match search', () => {
    renderWorkspace()

    fireEvent.change(screen.getByPlaceholderText('Search checks'), {
      target: { value: 'not-found' },
    })

    expect(screen.getByText('No checks match current search.')).toBeInTheDocument()
  })
})
