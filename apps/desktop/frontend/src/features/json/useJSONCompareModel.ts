import {
  defaultJSONCommon,
} from '../../useDesktopModeState'
import { useJSONCompareWorkflow, type UseJSONCompareWorkflowOptions } from './useJSONCompareWorkflow'
import { useJSONCompareViewState } from './useJSONCompareViewState'
import type { TextDiffLayout } from '../text/useTextDiffViewState'

export type JSONCompareModelDeps = Pick<
  UseJSONCompareWorkflowOptions,
  | 'getCompareJSONValuesRich'
  | 'getPickJSONFile'
  | 'getLoadTextFile'
  | 'onJSONCompareCompleted'
  | 'setJSONRecentPairs'
> & {
  textDiffLayout: TextDiffLayout
}

export function useJSONCompareModel(deps: JSONCompareModelDeps) {
  const workflow = useJSONCompareWorkflow({
    initialCommon: defaultJSONCommon,
    getCompareJSONValuesRich: deps.getCompareJSONValuesRich,
    getPickJSONFile: deps.getPickJSONFile,
    getLoadTextFile: deps.getLoadTextFile,
    onJSONCompareCompleted: deps.onJSONCompareCompleted,
    setJSONRecentPairs: deps.setJSONRecentPairs,
  })

  const viewState = useJSONCompareViewState({
    jsonRichResult: workflow.jsonRichResult,
    jsonOldText: workflow.jsonOldText,
    jsonNewText: workflow.jsonNewText,
    textDiffLayout: deps.textDiffLayout,
  })

  const compareDisabled =
    workflow.jsonEditorBusy || workflow.jsonInputEmpty || workflow.jsonInputInvalid

  return { workflow, viewState, compareDisabled }
}

export type JSONCompareModel = ReturnType<typeof useJSONCompareModel>
