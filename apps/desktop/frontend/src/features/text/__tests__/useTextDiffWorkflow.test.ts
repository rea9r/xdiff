import { useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DiffResponse, DesktopRecentPair } from '../../../types'
import { useTextDiffWorkflow } from '../useTextDiffWorkflow'

const initialCommon = {
  outputFormat: 'text',
  textStyle: 'auto',
  ignorePaths: [],
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreEOL: false,
}

function useWorkflowWithRecent(
  options: Omit<Parameters<typeof useTextDiffWorkflow>[0], 'setTextRecentPairs'>,
) {
  const [textRecentPairs, setTextRecentPairs] = useState<DesktopRecentPair[]>([])
  const workflow = useTextDiffWorkflow({ ...options, setTextRecentPairs })
  return { ...workflow, textRecentPairs }
}

describe('useTextDiffWorkflow', () => {
  it('stores diff result and recent pair when running with source paths', async () => {
    const response: DiffResponse = {
      exitCode: 1,
      diffFound: true,
      output: 'diff output',
    }

    const diffText = async () => response

    const { result } = renderHook(() =>
      useWorkflowWithRecent({
        initialCommon,
        getDiffText: () => diffText,
        getPickTextFile: () => undefined,
        getPickSaveTextFile: () => undefined,
        getLoadTextFile: () => undefined,
        getSaveTextFile: () => undefined,
      }),
    )

    await act(async () => {
      await result.current.runTextDiffWithValues({
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
        getDiffText: () => undefined,
        getPickTextFile: () => undefined,
        getPickSaveTextFile: () => undefined,
        getLoadTextFile: () => undefined,
        getSaveTextFile: () => undefined,
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

  it('saves new side via existing source path and updates state', async () => {
    const calls: Array<{ path: string; content: string; encoding?: string }> = []

    const { result } = renderHook(() =>
      useWorkflowWithRecent({
        initialCommon,
        getDiffText: () => undefined,
        getPickTextFile: () => undefined,
        getPickSaveTextFile: () => async () => '/tmp/picked.txt',
        getLoadTextFile: () => undefined,
        getSaveTextFile: () => async (req) => {
          calls.push(req)
          return { path: req.path, encoding: req.encoding ?? 'utf-8' }
        },
      }),
    )

    act(() => {
      result.current.setTextNew('hello')
      result.current.setTextNewSourcePath('/tmp/new.txt')
    })

    let ok = false
    await act(async () => {
      ok = await result.current.saveTextSide('new')
    })

    expect(ok).toBe(true)
    expect(calls).toEqual([{ path: '/tmp/new.txt', content: 'hello', encoding: 'utf-8' }])
    expect(result.current.textNewSourcePath).toBe('/tmp/new.txt')
  })

  it('falls back to picker when no source path on Save', async () => {
    const calls: Array<{ path: string; content: string; encoding?: string }> = []

    const { result } = renderHook(() =>
      useWorkflowWithRecent({
        initialCommon,
        getDiffText: () => undefined,
        getPickTextFile: () => undefined,
        getPickSaveTextFile: () => async () => '/tmp/picked.txt',
        getLoadTextFile: () => undefined,
        getSaveTextFile: () => async (req) => {
          calls.push(req)
          return { path: req.path, encoding: req.encoding ?? 'utf-8' }
        },
      }),
    )

    act(() => {
      result.current.setTextOld('saved-via-picker')
    })

    let ok = false
    await act(async () => {
      ok = await result.current.saveTextSide('old')
    })

    expect(ok).toBe(true)
    expect(calls).toEqual([
      { path: '/tmp/picked.txt', content: 'saved-via-picker', encoding: 'utf-8' },
    ])
    expect(result.current.textOldSourcePath).toBe('/tmp/picked.txt')
  })
})
