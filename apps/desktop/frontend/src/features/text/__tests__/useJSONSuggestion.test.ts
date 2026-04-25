import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isLikelyJSON, useJSONSuggestion } from '../useJSONSuggestion'

describe('isLikelyJSON', () => {
  it('returns true for valid object literals', () => {
    expect(isLikelyJSON('{"a": 1}')).toBe(true)
    expect(isLikelyJSON('  {"a": 1}\n')).toBe(true)
    expect(isLikelyJSON('[1, 2, 3]')).toBe(true)
  })

  it('returns false for empty or whitespace input', () => {
    expect(isLikelyJSON('')).toBe(false)
    expect(isLikelyJSON('   ')).toBe(false)
  })

  it('returns false when content does not start with { or [', () => {
    expect(isLikelyJSON('"a string"')).toBe(false)
    expect(isLikelyJSON('42')).toBe(false)
    expect(isLikelyJSON('true')).toBe(false)
    expect(isLikelyJSON('null')).toBe(false)
  })

  it('returns false for malformed JSON', () => {
    expect(isLikelyJSON('{"a":')).toBe(false)
    expect(isLikelyJSON('{a: 1}')).toBe(false)
  })
})

describe('useJSONSuggestion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows suggestion after debounce when both inputs parse as JSON', () => {
    const { result, rerender } = renderHook(
      ({ oldValue, newValue }) => useJSONSuggestion(oldValue, newValue, 100),
      { initialProps: { oldValue: '', newValue: '' } },
    )

    expect(result.current.shouldShow).toBe(false)

    rerender({ oldValue: '{"a": 1}', newValue: '{"a": 2}' })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.shouldShow).toBe(true)
  })

  it('does not show suggestion when one side is not JSON', () => {
    const { result } = renderHook(() =>
      useJSONSuggestion('{"a": 1}', 'hello world', 100),
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.shouldShow).toBe(false)
  })

  it('hides suggestion after dismiss and stays hidden until content changes', () => {
    const { result, rerender } = renderHook(
      ({ oldValue, newValue }) => useJSONSuggestion(oldValue, newValue, 100),
      { initialProps: { oldValue: '{"a": 1}', newValue: '{"a": 2}' } },
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.shouldShow).toBe(true)

    act(() => {
      result.current.dismiss()
    })
    expect(result.current.shouldShow).toBe(false)

    rerender({ oldValue: '{"a": 1}', newValue: '{"a": 2}' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.shouldShow).toBe(false)

    rerender({ oldValue: '{"a": 1}', newValue: '{"a": 3}' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.shouldShow).toBe(true)
  })
})
