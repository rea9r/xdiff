import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useJSONCompareWorkflow } from '../useJSONCompareWorkflow'

const initialCommon = {
  failOn: 'none',
  outputFormat: 'text',
  textStyle: 'patch',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
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
      }),
    )

    await waitFor(() => {
      expect(result.current.jsonPatchBlockedByFilters).toBe(true)
      expect(result.current.jsonCommon.textStyle).toBe('semantic')
    })
  })
})
