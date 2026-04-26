import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDesktopTabsManager } from '../useDesktopTabsManager'
import type { DesktopState, DesktopTabSession } from '../types'

function makeSession(id: string, label: string): DesktopTabSession {
  return {
    id,
    label,
    lastUsedMode: 'json',
    json: {
      oldSourcePath: '',
      newSourcePath: '',
      ignoreOrder: false,
      common: {
        outputFormat: 'text',
        textStyle: 'auto',
        ignorePaths: [],
        showPaths: false,
        ignoreWhitespace: false,
        ignoreCase: false,
        ignoreEOL: false,
      },
    },
    text: {
      oldSourcePath: '',
      newSourcePath: '',
      common: {
        outputFormat: 'text',
        textStyle: 'auto',
        ignorePaths: [],
        showPaths: false,
        ignoreWhitespace: false,
        ignoreCase: false,
        ignoreEOL: false,
      },
      diffLayout: 'split',
    },
    directory: {
      leftRoot: '',
      rightRoot: '',
      currentPath: '',
      viewMode: 'list',
    },
  }
}

function makeInitial(ids: string[]): DesktopState {
  return {
    version: 3,
    tabs: ids.map((id) => makeSession(id, id.toUpperCase())),
    activeTabId: ids[0],
    jsonRecentPairs: [],
    textRecentPairs: [],
    directoryRecentPairs: [],
  }
}

describe('useDesktopTabsManager.reorderTab', () => {
  it('moves the source tab into the target position (forward)', () => {
    const initial = makeInitial(['a', 'b', 'c', 'd'])
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit: vi.fn(),
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.reorderTab('a', 'c'))

    expect(result.current.tabs.map((t) => t.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves the source tab into the target position (backward)', () => {
    const initial = makeInitial(['a', 'b', 'c', 'd'])
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit: vi.fn(),
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.reorderTab('d', 'b'))

    expect(result.current.tabs.map((t) => t.id)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('is a no-op when the source equals the target', () => {
    const initial = makeInitial(['a', 'b', 'c'])
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit: vi.fn(),
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.reorderTab('b', 'b'))

    expect(result.current.tabs.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op when an id is unknown', () => {
    const initial = makeInitial(['a', 'b'])
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit: vi.fn(),
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.reorderTab('a', 'zzz'))

    expect(result.current.tabs.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('persists the new order via commit', () => {
    const initial = makeInitial(['a', 'b', 'c'])
    const commit = vi.fn()
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit,
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.reorderTab('a', 'c'))

    const calls = commit.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const updater = calls[calls.length - 1][0] as (prev: DesktopState) => DesktopState
    const next = updater(initial)
    expect(next.tabs.map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('useDesktopTabsManager.closeOthers', () => {
  it('keeps only the specified tab and makes it active', () => {
    const initial = makeInitial(['a', 'b', 'c'])
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit: vi.fn(),
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.closeOthers('b'))

    expect(result.current.tabs.map((t) => t.id)).toEqual(['b'])
    expect(result.current.activeTabId).toBe('b')
  })

  it('is a no-op when only one tab exists', () => {
    const initial = makeInitial(['only'])
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit: vi.fn(),
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.closeOthers('only'))

    expect(result.current.tabs.map((t) => t.id)).toEqual(['only'])
  })
})

describe('useDesktopTabsManager.closeToRight', () => {
  it('removes tabs after the specified one', () => {
    const initial = makeInitial(['a', 'b', 'c', 'd'])
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit: vi.fn(),
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.closeToRight('b'))

    expect(result.current.tabs.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('is a no-op when called on the rightmost tab', () => {
    const initial = makeInitial(['a', 'b'])
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit: vi.fn(),
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.closeToRight('b'))

    expect(result.current.tabs.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('useDesktopTabsManager.closeAll', () => {
  it('replaces all tabs with a single fresh tab', () => {
    const initial = makeInitial(['a', 'b', 'c'])
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit: vi.fn(),
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.closeAll())

    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.tabs[0].id).not.toBe('a')
    expect(result.current.tabs[0].id).not.toBe('b')
    expect(result.current.tabs[0].id).not.toBe('c')
    expect(result.current.activeTabId).toBe(result.current.tabs[0].id)
  })

  it('persists the reset via commit', () => {
    const initial = makeInitial(['a', 'b'])
    const commit = vi.fn()
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit,
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.closeAll())

    const updater = commit.mock.calls[0][0] as (prev: DesktopState) => DesktopState
    const next = updater(initial)
    expect(next.tabs).toHaveLength(1)
    expect(next.activeTabId).toBe(next.tabs[0].id)
  })
})

describe('useDesktopTabsManager.addTab', () => {
  it('inherits lastUsedMode from the currently active tab', () => {
    const initial = makeInitial(['a', 'b'])
    initial.tabs[0].lastUsedMode = 'text'
    initial.activeTabId = 'a'

    const commit = vi.fn()
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit,
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.addTab())

    const synchronousCall = commit.mock.calls[0]
    expect(synchronousCall).toBeDefined()
    const updater = synchronousCall[0] as (prev: DesktopState) => DesktopState
    const next = updater(initial)
    const newSession = next.tabs[next.tabs.length - 1]
    expect(newSession.lastUsedMode).toBe('text')
  })

  it('falls back to the fallback session mode when no active tab session is found', () => {
    const initial = makeInitial(['a'])
    initial.activeTabId = 'missing'

    const commit = vi.fn()
    const { result } = renderHook(() =>
      useDesktopTabsManager({
        initial,
        commit,
        fallbackTabSession: makeSession,
      }),
    )

    act(() => result.current.addTab())

    const updater = commit.mock.calls[0][0] as (prev: DesktopState) => DesktopState
    const next = updater(initial)
    const newSession = next.tabs[next.tabs.length - 1]
    expect(newSession.lastUsedMode).toBe('json')
  })
})
