import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useJSONCompareWorkflow } from '../useJSONCompareWorkflow'

const initialCommon = {
  outputFormat: 'text',
  textStyle: 'patch',
  ignorePaths: [],
  showPaths: false,
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreEOL: false,
}

describe('useJSONCompareWorkflow', () => {
  it('falls back from patch to semantic when patch mode is blocked', async () => {
    const { result } = renderHook(() =>
      useJSONCompareWorkflow({
        initialCommon,
        initialIgnoreOrder: true,
        getCompareJSONValuesRich: () => undefined,
        getPickJSONFile: () => undefined,
        getLoadTextFile: () => undefined,
        setJSONRecentPairs: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.jsonPatchBlockedByFilters).toBe(true)
      expect(result.current.jsonCommon.textStyle).toBe('semantic')
    })
  })
})
