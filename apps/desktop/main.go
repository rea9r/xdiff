package main

import (
	"context"
	"embed"

	"github.com/rea9r/xdiff/pkg/desktopapi"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

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

func (a *App) CompareSpecFiles(req desktopapi.CompareSpecRequest) (*desktopapi.CompareResponse, error) {
	return a.api.CompareSpecFiles(req)
}

func (a *App) CompareText(req desktopapi.CompareTextRequest) (*desktopapi.CompareResponse, error) {
	return a.api.CompareText(req)
}

func (a *App) RunScenario(req desktopapi.RunScenarioRequest) (*desktopapi.ScenarioRunResponse, error) {
	return a.api.RunScenario(req)
}

func (a *App) ListScenarioChecks(req desktopapi.ListScenarioChecksRequest) (*desktopapi.ScenarioListResponse, error) {
	return a.api.ListScenarioChecks(req)
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

func (a *App) PickSpecFile() (string, error) {
	return a.pickFile("Select OpenAPI spec", []runtime.FileFilter{
		{
			DisplayName: "OpenAPI (*.yaml;*.yml;*.json)",
			Pattern:     "*.yaml;*.yml;*.json",
		},
		{
			DisplayName: "All files (*.*)",
			Pattern:     "*.*",
		},
	})
}

func (a *App) PickScenarioFile() (string, error) {
	return a.pickFile("Select scenario file", []runtime.FileFilter{
		{
			DisplayName: "Scenario YAML (*.yaml;*.yml)",
			Pattern:     "*.yaml;*.yml",
		},
		{
			DisplayName: "All files (*.*)",
			Pattern:     "*.*",
		},
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
	})
	if err != nil {
		panic(err)
	}
}
