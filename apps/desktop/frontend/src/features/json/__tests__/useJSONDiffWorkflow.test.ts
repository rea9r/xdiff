import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useJSONDiffWorkflow } from '../useJSONDiffWorkflow'

const initialCommon = {
  outputFormat: 'text',
  textStyle: 'patch',
  ignorePaths: [],
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreEOL: false,
}

describe('useJSONDiffWorkflow', () => {
  it('falls back from patch to semantic when patch mode is blocked', async () => {
    const { result } = renderHook(() =>
      useJSONDiffWorkflow({
        initialCommon,
        initialIgnoreOrder: true,
        getDiffJSONValuesRich: () => undefined,
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
