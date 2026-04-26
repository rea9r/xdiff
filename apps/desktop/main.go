package main

import (
	"context"

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

func (a *App) CompareJSONFiles(req desktopapi.CompareJSONRequest) (*desktopapi.CompareResponse, error) {
	return a.api.CompareJSONFiles(req)
}

func (a *App) CompareJSONRich(req desktopapi.CompareJSONRequest) (*desktopapi.CompareJSONRichResponse, error) {
	return a.api.CompareJSONRich(req)
}

func (a *App) CompareJSONValuesRich(req desktopapi.CompareJSONValuesRequest) (*desktopapi.CompareJSONRichResponse, error) {
	return a.api.CompareJSONValuesRich(req)
}

func (a *App) CompareText(req desktopapi.CompareTextRequest) (*desktopapi.CompareResponse, error) {
	return a.api.CompareText(req)
}

func (a *App) LoadTextFile(req desktopapi.LoadTextFileRequest) (*desktopapi.LoadTextFileResponse, error) {
	return a.api.LoadTextFile(req)
}

func (a *App) CompareDirectories(req desktopapi.CompareDirectoriesRequest) (*desktopapi.CompareDirectoriesResponse, error) {
	return a.api.CompareDirectories(req)
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

func (a *App) StartAISetup(req desktopapi.AISetupRequest) error {
	return a.api.StartAISetup(req)
}

func (a *App) AISetupProgress() (*desktopapi.AISetupProgress, error) {
	return a.api.AISetupProgressSnapshot()
}

func (a *App) CancelAISetup() error {
	return a.api.CancelAISetup()
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
