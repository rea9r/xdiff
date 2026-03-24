# xdiff Desktop (Wails, Phase 5A)

This app is an experimental desktop GUI for xdiff.

## Scope (Phase 5A)

- JSON file comparison
- OpenAPI spec comparison
- Scenario checks listing
- Scenario selected run (`only`)
- Native file picker for local JSON/spec/scenario paths
- Scenario run summary
- Per-check scenario result list
- Selected scenario result detail
- JSON/spec advanced options
- Show paths and breaking-only toggles
- Output format and text style controls
- Fail-on and ignore-path controls for JSON/spec
- Paste-first text compare workspace with local file load and rich/raw diff views
- Text compare supports dedicated `Load old...` / `Load new...` / `Paste old` / `Paste new` / `Copy raw output` actions, plus `Swap` / `Clear`

Not included yet:

- URL compare GUI
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

Use Browse... in file-based modes to select local files. Text mode supports both paste-first input and dedicated `Load old...` / `Load new...` actions.

## Build frontend only

```bash
cd apps/desktop
npm --prefix frontend run build
```
