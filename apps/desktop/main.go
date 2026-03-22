package main

import (
	"embed"

	"github.com/rea9r/xdiff/pkg/desktopapi"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

type App struct {
	api *desktopapi.Service
}

func NewApp() *App {
	return &App{api: desktopapi.NewService()}
}

func (a *App) CompareJSONFiles(req desktopapi.CompareJSONRequest) (*desktopapi.CompareResponse, error) {
	return a.api.CompareJSONFiles(req)
}

func (a *App) CompareSpecFiles(req desktopapi.CompareSpecRequest) (*desktopapi.CompareResponse, error) {
	return a.api.CompareSpecFiles(req)
}

func (a *App) RunScenario(req desktopapi.RunScenarioRequest) (*desktopapi.ScenarioRunResponse, error) {
	return a.api.RunScenario(req)
}

func (a *App) ListScenarioChecks(req desktopapi.ListScenarioChecksRequest) (*desktopapi.ScenarioListResponse, error) {
	return a.api.ListScenarioChecks(req)
}

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:  "xdiff Desktop",
		Width:  1280,
		Height: 860,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Bind: []interface{}{app},
	})
	if err != nil {
		panic(err)
	}
}
