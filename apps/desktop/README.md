# xdiff Desktop (Wails, Phase 7A)

This app is an experimental desktop GUI for xdiff.

## Scope (Phase 7A)

- Mantine-based visual foundation with light / dark / system theme support
- App shell refresh with shared header / sidebar / main layout
- Shared UI primitives for controls, badges, cards, tables, and notifications
- Existing JSON/spec/text/scenario/folder workflows preserved on top of the new visual foundation
- Theme-aware viewer tokens and responsive sidebar toggle for narrower window widths
- Compact density pass and adaptive layout polish for narrower non-fullscreen window sizes

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
- Text rich diff supports `Unified` / `Split` view toggle
- Text rich diff keeps omitted unchanged sections collapsed by default, with per-section and global expand/collapse controls
- Text rich diff supports row search with next/prev navigation and auto-reveal of the active hidden unchanged section
- Folder compare MVP with recursive directory scan, flat result list, and child compare launch

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
Folder compare is desktop-only in this phase and does not add a new CLI command yet.

## Build frontend only

```bash
cd apps/desktop
npm --prefix frontend run build
```
