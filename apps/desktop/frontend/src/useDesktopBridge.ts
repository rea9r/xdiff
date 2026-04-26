import { useMemo } from 'react'
import * as App from '../wailsjs/go/main/App'
import type {
  AIProviderStatus,
  AISetupProgress,
  AISetupRequest,
  CompareCommon,
  CompareResponse,
  CompareJSONValuesRequest,
  CompareJSONRichResponse,
  CompareDirectoriesRequest,
  CompareDirectoriesResponse,
  DesktopState,
  ExplainDiffRequest,
  ExplainDiffResponse,
  LoadTextFileRequest,
  LoadTextFileResponse,
} from './types'

// ---------------------------------------------------------------------------
// Adapter layer: Wails-generated bindings use class types with `convertValues`,
// while the rest of the app uses plain type aliases from src/types.ts.
// The structures are identical — only the class wrapper differs.
// We cast at this boundary so the rest of the app stays fully typed.
// ---------------------------------------------------------------------------

type CompareTextReq = { oldText: string; newText: string; common: CompareCommon }

export function useDesktopBridge() {
  return useMemo(
    () => ({
      compareText: (req: CompareTextReq): Promise<CompareResponse> =>
        App.CompareText(req as any),

      compareJSONValuesRich: (
        req: CompareJSONValuesRequest,
      ): Promise<CompareJSONRichResponse> =>
        App.CompareJSONValuesRich(req as any) as Promise<CompareJSONRichResponse>,

      compareDirectories: (
        req: CompareDirectoriesRequest,
      ): Promise<CompareDirectoriesResponse> =>
        App.CompareDirectories(req as any) as Promise<CompareDirectoriesResponse>,

      pickJSONFile: App.PickJSONFile,
      pickTextFile: App.PickTextFile,
      pickDirectoryRoot: App.PickDirectoryRoot,

      loadTextFile: (req: LoadTextFileRequest): Promise<LoadTextFileResponse> =>
        App.LoadTextFile(req as any) as unknown as Promise<LoadTextFileResponse>,

      loadDesktopState: (): Promise<DesktopState> =>
        App.LoadDesktopState() as Promise<DesktopState>,

      saveDesktopState: (state: DesktopState): Promise<void> =>
        App.SaveDesktopState(state as any),

      aiProviderStatus: (): Promise<AIProviderStatus> =>
        App.AIProviderStatus() as unknown as Promise<AIProviderStatus>,

      explainDiff: (req: ExplainDiffRequest): Promise<ExplainDiffResponse> =>
        App.ExplainDiff(req as any) as unknown as Promise<ExplainDiffResponse>,

      startAISetup: (req: AISetupRequest): Promise<void> =>
        App.StartAISetup(req as any),

      aiSetupProgress: (): Promise<AISetupProgress> =>
        App.AISetupProgress() as unknown as Promise<AISetupProgress>,

      cancelAISetup: (): Promise<void> => App.CancelAISetup(),

      openOllamaDownloadPage: (): Promise<void> => App.OpenOllamaDownloadPage(),
    }),
    [],
  )
}
