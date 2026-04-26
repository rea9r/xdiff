import { useMemo } from 'react'
import * as App from '../wailsjs/go/main/App'
import type {
  CompareCommon,
  CompareResponse,
  CompareJSONValuesRequest,
  CompareJSONRichResponse,
  CompareFoldersRequest,
  CompareFoldersResponse,
  DesktopState,
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

      compareFolders: (
        req: CompareFoldersRequest,
      ): Promise<CompareFoldersResponse> =>
        App.CompareFolders(req as any) as Promise<CompareFoldersResponse>,

      pickJSONFile: App.PickJSONFile,
      pickTextFile: App.PickTextFile,
      pickFolderRoot: App.PickFolderRoot,

      loadTextFile: (req: LoadTextFileRequest): Promise<LoadTextFileResponse> =>
        App.LoadTextFile(req as any) as unknown as Promise<LoadTextFileResponse>,

      loadDesktopState: (): Promise<DesktopState> =>
        App.LoadDesktopState() as Promise<DesktopState>,

      saveDesktopState: (state: DesktopState): Promise<void> =>
        App.SaveDesktopState(state as any),
    }),
    [],
  )
}
