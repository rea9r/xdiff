import {
  defaultTextCommon,
} from '../../useDesktopModeState'
import { useTextDiffWorkflow, type UseTextDiffWorkflowOptions } from './useTextDiffWorkflow'
import { useTextDiffViewState } from './useTextDiffViewState'

export type TextDiffModelDeps = Pick<
  UseTextDiffWorkflowOptions,
  | 'getDiffText'
  | 'getPickTextFile'
  | 'getPickSaveTextFile'
  | 'getLoadTextFile'
  | 'getSaveTextFile'
  | 'onTextDiffCompleted'
  | 'setTextRecentPairs'
>

export function useTextDiffModel(deps: TextDiffModelDeps) {
  const workflow = useTextDiffWorkflow({
    initialCommon: defaultTextCommon,
    getDiffText: deps.getDiffText,
    getPickTextFile: deps.getPickTextFile,
    getPickSaveTextFile: deps.getPickSaveTextFile,
    getLoadTextFile: deps.getLoadTextFile,
    getSaveTextFile: deps.getSaveTextFile,
    onTextDiffCompleted: deps.onTextDiffCompleted,
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

export type TextDiffModel = ReturnType<typeof useTextDiffModel>
