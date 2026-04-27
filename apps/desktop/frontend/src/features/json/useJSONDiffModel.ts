import {
  defaultJSONCommon,
} from '../../useDesktopModeState'
import { useJSONDiffWorkflow, type UseJSONDiffWorkflowOptions } from './useJSONDiffWorkflow'
import { useJSONDiffViewState } from './useJSONDiffViewState'
import type { TextDiffLayout } from '../text/useTextDiffViewState'

export type JSONDiffModelDeps = Pick<
  UseJSONDiffWorkflowOptions,
  | 'getDiffJSONValuesRich'
  | 'getPickJSONFile'
  | 'getLoadTextFile'
  | 'onJSONDiffCompleted'
  | 'setJSONRecentPairs'
> & {
  textDiffLayout: TextDiffLayout
}

export function useJSONDiffModel(deps: JSONDiffModelDeps) {
  const workflow = useJSONDiffWorkflow({
    initialCommon: defaultJSONCommon,
    getDiffJSONValuesRich: deps.getDiffJSONValuesRich,
    getPickJSONFile: deps.getPickJSONFile,
    getLoadTextFile: deps.getLoadTextFile,
    onJSONDiffCompleted: deps.onJSONDiffCompleted,
    setJSONRecentPairs: deps.setJSONRecentPairs,
  })

  const viewState = useJSONDiffViewState({
    jsonRichResult: workflow.jsonRichResult,
    jsonOldText: workflow.jsonOldText,
    jsonNewText: workflow.jsonNewText,
    textDiffLayout: deps.textDiffLayout,
  })

  const diffDisabled =
    workflow.jsonEditorBusy || workflow.jsonInputEmpty || workflow.jsonInputInvalid

  return { workflow, viewState, diffDisabled }
}

export type JSONDiffModel = ReturnType<typeof useJSONDiffModel>
