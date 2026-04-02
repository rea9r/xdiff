import { useMemo } from 'react'
import * as App from '../wailsjs/go/main/App'
import type {
  CompareCommon,
  CompareResponse,
  CompareJSONValuesRequest,
  CompareJSONRichResponse,
  CompareSpecValuesRequest,
  CompareSpecRichResponse,
  CompareFoldersRequest,
  CompareFoldersResponse,
  DesktopState,
  LoadTextFileRequest,
  LoadTextFileResponse,
  ScenarioRunResponse,
  ScenarioListResponse,
} from './types'

// ---------------------------------------------------------------------------
// Adapter layer: Wails-generated bindings use class types with `convertValues`,
// while the rest of the app uses plain type aliases from src/types.ts.
// The structures are identical — only the class wrapper differs.
// We cast at this boundary so the rest of the app stays fully typed.
// ---------------------------------------------------------------------------

type CompareTextReq = { oldText: string; newText: string; common: CompareCommon }
type RunScenarioReq = { scenarioPath: string; reportFormat: string }
type ListScenarioChecksReq = { scenarioPath: string }

export function useDesktopBridge() {
  return useMemo(
    () => ({
      compareText: (req: CompareTextReq): Promise<CompareResponse> =>
        App.CompareText(req as any),

      compareJSONValuesRich: (
        req: CompareJSONValuesRequest,
      ): Promise<CompareJSONRichResponse> =>
        App.CompareJSONValuesRich(req as any) as Promise<CompareJSONRichResponse>,

      compareSpecValuesRich: (
        req: CompareSpecValuesRequest,
      ): Promise<CompareSpecRichResponse> =>
        App.CompareSpecValuesRich(req as any) as Promise<CompareSpecRichResponse>,

      compareFolders: (
        req: CompareFoldersRequest,
      ): Promise<CompareFoldersResponse> =>
        App.CompareFolders(req as any) as Promise<CompareFoldersResponse>,

      runScenario: (req: RunScenarioReq): Promise<ScenarioRunResponse> =>
        App.RunScenario(req as any),

      listScenarioChecks: (
        req: ListScenarioChecksReq,
      ): Promise<ScenarioListResponse> =>
        App.ListScenarioChecks(req as any),

      pickJSONFile: App.PickJSONFile,
      pickSpecFile: App.PickSpecFile,
      pickScenarioFile: App.PickScenarioFile,
      pickTextFile: App.PickTextFile,
      pickFolderRoot: App.PickFolderRoot,

      loadTextFile: (req: LoadTextFileRequest): Promise<LoadTextFileResponse> =>
        App.LoadTextFile(req as any),

      loadDesktopState: (): Promise<DesktopState> =>
        App.LoadDesktopState() as Promise<DesktopState>,

      saveDesktopState: (state: DesktopState): Promise<void> =>
        App.SaveDesktopState(state as any),
    }),
    [],
  )
}
