import { useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CompareResponse, DesktopRecentPair } from '../../../types'
import { useTextCompareWorkflow } from '../useTextCompareWorkflow'

const initialCommon = {
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  showPaths: false,
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreEOL: false,
}

function useWorkflowWithRecent(
  options: Omit<Parameters<typeof useTextCompareWorkflow>[0], 'setTextRecentPairs'>,
) {
  const [textRecentPairs, setTextRecentPairs] = useState<DesktopRecentPair[]>([])
  const workflow = useTextCompareWorkflow({ ...options, setTextRecentPairs })
  return { ...workflow, textRecentPairs }
}

describe('useTextCompareWorkflow', () => {
  it('stores compare result and recent pair when running with source paths', async () => {
    const response: CompareResponse = {
      exitCode: 1,
      diffFound: true,
      output: 'diff output',
    }

    const compareText = async () => response

    const { result } = renderHook(() =>
      useWorkflowWithRecent({
        initialCommon,
        getCompareText: () => compareText,
        getPickTextFile: () => undefined,
        getLoadTextFile: () => undefined,
      }),
    )

    await act(async () => {
      await result.current.runTextCompareWithValues({
        oldText: 'old',
        newText: 'new',
        oldSourcePath: '/tmp/old.txt',
        newSourcePath: '/tmp/new.txt',
      })
    })

    expect(result.current.textResult).toEqual(response)
    expect(result.current.textLastRunOld).toBe('old')
    expect(result.current.textLastRunNew).toBe('new')
    expect(result.current.textLastRunOutputFormat).toBe('text')
    expect(result.current.textRecentPairs).toHaveLength(1)
    expect(result.current.textRecentPairs[0]).toMatchObject({
      oldPath: '/tmp/old.txt',
      newPath: '/tmp/new.txt',
    })
  })

  it('pastes old text from clipboard and clears source path', async () => {
    Object.assign(window as Window & { runtime?: { ClipboardGetText?: () => Promise<string> } }, {
      runtime: {
        ClipboardGetText: async () => 'from clipboard',
      },
    })

    const { result } = renderHook(() =>
      useWorkflowWithRecent({
        initialCommon,
        getCompareText: () => undefined,
        getPickTextFile: () => undefined,
        getLoadTextFile: () => undefined,
      }),
    )

    act(() => {
      result.current.setTextOldSourcePath('/tmp/old.txt')
    })

    await act(async () => {
      await result.current.pasteTextFromClipboard('old')
    })

    expect(result.current.textOld).toBe('from clipboard')
    expect(result.current.textOldSourcePath).toBe('')
  })
})
