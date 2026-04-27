import { useMemo } from 'react'
import * as App from '../wailsjs/go/main/App'
import type {
  AIProviderStatus,
  AISetupProgress,
  AISetupRequest,
  DiffCommon,
  DiffResponse,
  DiffJSONValuesRequest,
  DiffJSONRichResponse,
  DiffDirectoriesRequest,
  DiffDirectoriesResponse,
  DeleteOllamaModelRequest,
  DesktopState,
  DirectorySummaryRequest,
  DirectorySummaryResponse,
  ExplainDiffRequest,
  ExplainDiffResponse,
  ExplainDiffStreamRequest,
  LoadTextFileRequest,
  LoadTextFileResponse,
  SaveTextFileRequest,
  SaveTextFileResponse,
} from './types'

// ---------------------------------------------------------------------------
// Adapter layer: Wails-generated bindings use class types with `convertValues`,
// while the rest of the app uses plain type aliases from src/types.ts.
// The structures are identical — only the class wrapper differs.
// We cast at this boundary so the rest of the app stays fully typed.
// ---------------------------------------------------------------------------

type DiffTextReq = { oldText: string; newText: string; common: DiffCommon }

export function useDesktopBridge() {
  return useMemo(
    () => ({
      diffText: (req: DiffTextReq): Promise<DiffResponse> =>
        App.DiffText(req as any),

      diffJSONValuesRich: (
        req: DiffJSONValuesRequest,
      ): Promise<DiffJSONRichResponse> =>
        App.DiffJSONValuesRich(req as any) as Promise<DiffJSONRichResponse>,

      diffDirectories: (
        req: DiffDirectoriesRequest,
      ): Promise<DiffDirectoriesResponse> =>
        App.DiffDirectories(req as any) as Promise<DiffDirectoriesResponse>,

      pickJSONFile: App.PickJSONFile,
      pickTextFile: App.PickTextFile,
      pickSaveTextFile: (defaultName: string): Promise<string> =>
        App.PickSaveTextFile(defaultName),
      pickDirectoryRoot: App.PickDirectoryRoot,

      loadTextFile: (req: LoadTextFileRequest): Promise<LoadTextFileResponse> =>
        App.LoadTextFile(req as any) as unknown as Promise<LoadTextFileResponse>,

      saveTextFile: (req: SaveTextFileRequest): Promise<SaveTextFileResponse> =>
        App.SaveTextFile(req as any) as unknown as Promise<SaveTextFileResponse>,

      loadDesktopState: (): Promise<DesktopState> =>
        App.LoadDesktopState() as Promise<DesktopState>,

      saveDesktopState: (state: DesktopState): Promise<void> =>
        App.SaveDesktopState(state as any),

      aiProviderStatus: (): Promise<AIProviderStatus> =>
        App.AIProviderStatus() as unknown as Promise<AIProviderStatus>,

      buildDirectorySummaryContext: (
        req: DirectorySummaryRequest,
      ): Promise<DirectorySummaryResponse> =>
        App.BuildDirectorySummaryContext(req as any) as unknown as Promise<DirectorySummaryResponse>,

      explainDiff: (req: ExplainDiffRequest): Promise<ExplainDiffResponse> =>
        App.ExplainDiff(req as any) as unknown as Promise<ExplainDiffResponse>,

      explainDiffStream: (req: ExplainDiffStreamRequest): Promise<ExplainDiffResponse> =>
        App.ExplainDiffStream(req as any) as unknown as Promise<ExplainDiffResponse>,

      startAISetup: (req: AISetupRequest): Promise<void> =>
        App.StartAISetup(req as any),

      aiSetupProgress: (): Promise<AISetupProgress> =>
        App.AISetupProgress() as unknown as Promise<AISetupProgress>,

      cancelAISetup: (): Promise<void> => App.CancelAISetup(),

      deleteOllamaModel: (req: DeleteOllamaModelRequest): Promise<void> =>
        App.DeleteOllamaModel(req as any),

      openOllamaDownloadPage: (): Promise<void> => App.OpenOllamaDownloadPage(),
    }),
    [],
  )
}
