# xdiff Desktop (Wails, Phase 1)

This app is an experimental desktop GUI for xdiff.

## Scope (Phase 1)

- JSON file comparison
- OpenAPI spec comparison
- Scenario run

Not included yet:

- Text compare GUI
- URL compare GUI
- File picker polish
- Packaging/distribution

## Prerequisites

- Go (same version as repository)
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- Node.js + npm

## Run (dev)

From this directory:

```bash
cd apps/desktop
npm --prefix frontend install
wails dev
```

## Build frontend only

```bash
cd apps/desktop
npm --prefix frontend run build
```
