import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CompareSpecRichResponse } from '../../../types'
import { useSpecCompareWorkflow } from '../useSpecCompareWorkflow'

const initialCommon = {
  failOn: 'none',
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  showPaths: false,
  onlyBreaking: false,
  noColor: true,
}

describe('useSpecCompareWorkflow', () => {
  it('updates rich result and recent pair when compare succeeds', async () => {
    const richResult: CompareSpecRichResponse = {
      result: {
        exitCode: 1,
        diffFound: true,
        output: 'diff',
      },
      diffText: 'diff text',
      summary: {
        added: 1,
        removed: 0,
        changed: 0,
        typeChanged: 0,
        breaking: 0,
      },
      diffs: [],
    }

    const compareSpecValuesRich = async () => richResult

    const { result } = renderHook(() =>
      useSpecCompareWorkflow({
        initialCommon,
        getCompareSpecValuesRich: () => compareSpecValuesRich,
        getPickSpecFile: () => undefined,
        getLoadTextFile: () => undefined,
      }),
    )

    await act(async () => {
      await result.current.runSpecCompareWithValues({
        oldText: 'old',
        newText: 'new',
        oldSourcePath: '/tmp/old.yaml',
        newSourcePath: '/tmp/new.yaml',
      })
    })

    expect(result.current.specRichResult).toEqual(richResult)
    expect(result.current.specRecentPairs).toHaveLength(1)
    expect(result.current.specRecentPairs[0]).toMatchObject({
      oldPath: '/tmp/old.yaml',
      newPath: '/tmp/new.yaml',
    })
  })

  it('derives language from source path and reports parse error', () => {
    const { result } = renderHook(() =>
      useSpecCompareWorkflow({
        initialCommon,
        getCompareSpecValuesRich: () => undefined,
        getPickSpecFile: () => undefined,
        getLoadTextFile: () => undefined,
      }),
    )

    act(() => {
      result.current.setSpecOldSourcePath('/tmp/openapi.yaml')
      result.current.setSpecOldText('invalid: [')
    })

    expect(result.current.specOldLanguage).toBe('yaml')
    expect(result.current.specOldParseError).toBeTruthy()
  })
})
