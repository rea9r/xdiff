package main

import (
	"context"
	"log"

	"github.com/rea9r/xdiff/pkg/desktopapi"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
	api *desktopapi.Service
}

func NewApp() *App {
	return &App{api: desktopapi.NewService()}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) DiffJSONFiles(req desktopapi.DiffJSONRequest) (*desktopapi.DiffResponse, error) {
	return a.api.DiffJSONFiles(req)
}

func (a *App) DiffJSONRich(req desktopapi.DiffJSONRequest) (*desktopapi.DiffJSONRichResponse, error) {
	return a.api.DiffJSONRich(req)
}

func (a *App) DiffJSONValuesRich(req desktopapi.DiffJSONValuesRequest) (*desktopapi.DiffJSONRichResponse, error) {
	return a.api.DiffJSONValuesRich(req)
}

func (a *App) DiffText(req desktopapi.DiffTextRequest) (*desktopapi.DiffResponse, error) {
	return a.api.DiffText(req)
}

func (a *App) LoadTextFile(req desktopapi.LoadTextFileRequest) (*desktopapi.LoadTextFileResponse, error) {
	return a.api.LoadTextFile(req)
}

func (a *App) SaveTextFile(req desktopapi.SaveTextFileRequest) (*desktopapi.SaveTextFileResponse, error) {
	return a.api.SaveTextFile(req)
}

func (a *App) DiffDirectories(req desktopapi.DiffDirectoriesRequest) (*desktopapi.DiffDirectoriesResponse, error) {
	return a.api.DiffDirectories(req)
}

func (a *App) LoadDesktopState() (*desktopapi.DesktopState, error) {
	return a.api.LoadDesktopState()
}

func (a *App) SaveDesktopState(req desktopapi.DesktopState) error {
	return a.api.SaveDesktopState(req)
}

func (a *App) AIProviderStatus() (*desktopapi.AIProviderStatus, error) {
	return a.api.AIProviderStatus()
}

func (a *App) ExplainDiff(req desktopapi.ExplainDiffRequest) (*desktopapi.ExplainDiffResponse, error) {
	return a.api.ExplainDiff(req)
}

func (a *App) ExplainDiffStream(req desktopapi.ExplainDiffStreamRequest) (*desktopapi.ExplainDiffResponse, error) {
	streamID := req.StreamID
	chunkEvent := "ai-explain-chunk-" + streamID
	thinkingEvent := "ai-explain-thinking-" + streamID
	chunkCount := 0
	thinkingCount := 0
	log.Printf("[ai] explain stream start event=%s model=%s", chunkEvent, req.Model)
	onChunk := func(chunk string) {
		if a.ctx == nil || streamID == "" {
			return
		}
		chunkCount++
		if chunkCount <= 3 || chunkCount%20 == 0 {
			log.Printf("[ai] emit chunk #%d len=%d", chunkCount, len(chunk))
		}
		runtime.EventsEmit(a.ctx, chunkEvent, chunk)
	}
	onThinking := func(chunk string) {
		if a.ctx == nil || streamID == "" {
			return
		}
		thinkingCount++
		if thinkingCount <= 3 || thinkingCount%50 == 0 {
			log.Printf("[ai] emit thinking #%d len=%d", thinkingCount, len(chunk))
		}
		runtime.EventsEmit(a.ctx, thinkingEvent, chunk)
	}
	resp, err := a.api.ExplainDiffStream(desktopapi.ExplainDiffRequest{
		DiffText: req.DiffText,
		Mode:     req.Mode,
		Language: req.Language,
		Model:    req.Model,
	}, onChunk, onThinking)
	respErr := ""
	if resp != nil {
		respErr = resp.Error
	}
	log.Printf("[ai] explain stream done chunks=%d thinking=%d resp.err=%q go.err=%v", chunkCount, thinkingCount, respErr, err)
	return resp, err
}

func (a *App) StartAISetup(req desktopapi.AISetupRequest) error {
	return a.api.StartAISetup(req)
}

func (a *App) AISetupProgress() (*desktopapi.AISetupProgress, error) {
	return a.api.AISetupProgressSnapshot()
}

func (a *App) CancelAISetup() error {
	return a.api.CancelAISetup()
}

func (a *App) DeleteOllamaModel(req desktopapi.DeleteOllamaModelRequest) error {
	return a.api.DeleteOllamaModel(req)
}

func (a *App) OpenOllamaDownloadPage() {
	if a.ctx == nil {
		return
	}
	runtime.BrowserOpenURL(a.ctx, "https://ollama.com/download")
}

func (a *App) PickJSONFile() (string, error) {
	return a.pickFile("Select JSON file", []runtime.FileFilter{
		{
			DisplayName: "JSON (*.json)",
			Pattern:     "*.json",
		},
		{
			DisplayName: "All files (*.*)",
			Pattern:     "*.*",
		},
	})
}

func (a *App) PickTextFile() (string, error) {
	return a.pickFile("Select text file", []runtime.FileFilter{
		{
			DisplayName: "Text-like (*.txt;*.md;*.log;*.csv;*.tsv;*.yaml;*.yml;*.json;*.xml;*.html;*.css;*.js;*.ts;*.tsx;*.jsx;*.go;*.py;*.sh;*.sql)",
			Pattern:     "*.txt;*.md;*.log;*.csv;*.tsv;*.yaml;*.yml;*.json;*.xml;*.html;*.css;*.js;*.ts;*.tsx;*.jsx;*.go;*.py;*.sh;*.sql",
		},
		{
			DisplayName: "All files (*.*)",
			Pattern:     "*.*",
		},
	})
}

func (a *App) PickSaveTextFile(defaultName string) (string, error) {
	if a.ctx == nil {
		return "", nil
	}

	return runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save text file",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Text-like (*.txt;*.md;*.log;*.csv;*.tsv;*.yaml;*.yml;*.json;*.xml;*.html;*.css;*.js;*.ts;*.tsx;*.jsx;*.go;*.py;*.sh;*.sql)",
				Pattern:     "*.txt;*.md;*.log;*.csv;*.tsv;*.yaml;*.yml;*.json;*.xml;*.html;*.css;*.js;*.ts;*.tsx;*.jsx;*.go;*.py;*.sh;*.sql",
			},
			{
				DisplayName: "All files (*.*)",
				Pattern:     "*.*",
			},
		},
	})
}

func (a *App) PickDirectoryRoot() (string, error) {
	if a.ctx == nil {
		return "", nil
	}

	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select directory",
	})
}

func (a *App) pickFile(title string, filters []runtime.FileFilter) (string, error) {
	if a.ctx == nil {
		return "", nil
	}

	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   title,
		Filters: filters,
	})
}

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "xdiff Desktop",
		Width:     1280,
		Height:    860,
		OnStartup: app.startup,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Bind: []interface{}{app},
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     true,
			DisableWebViewDrop: true,
		},
	})
	if err != nil {
		panic(err)
	}
}
