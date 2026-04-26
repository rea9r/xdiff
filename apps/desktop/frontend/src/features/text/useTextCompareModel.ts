import {
  defaultTextCommon,
} from '../../useDesktopModeState'
import { useTextCompareWorkflow, type UseTextCompareWorkflowOptions } from './useTextCompareWorkflow'
import { useTextDiffViewState } from './useTextDiffViewState'

export type TextCompareModelDeps = Pick<
  UseTextCompareWorkflowOptions,
  | 'getCompareText'
  | 'getPickTextFile'
  | 'getLoadTextFile'
  | 'onTextCompareCompleted'
  | 'setTextRecentPairs'
>

export function useTextCompareModel(deps: TextCompareModelDeps) {
  const workflow = useTextCompareWorkflow({
    initialCommon: defaultTextCommon,
    getCompareText: deps.getCompareText,
    getPickTextFile: deps.getPickTextFile,
    getLoadTextFile: deps.getLoadTextFile,
    onTextCompareCompleted: deps.onTextCompareCompleted,
    setTextRecentPairs: deps.setTextRecentPairs,
  })

  const viewState = useTextDiffViewState({
    textResult: workflow.textResult,
    textLastRunOld: workflow.textLastRunOld,
    textLastRunNew: workflow.textLastRunNew,
    textLastRunOutputFormat: workflow.textLastRunOutputFormat,
  })

  return { workflow, viewState }
}

export type TextCompareModel = ReturnType<typeof useTextCompareModel>
