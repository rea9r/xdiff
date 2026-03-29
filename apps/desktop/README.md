# xdiff Desktop (Wails, Phase 7D-1.5)

This app is an experimental desktop GUI for xdiff.

## Scope (Phase 7D-1.5)

- Mantine-based visual foundation with light / dark / system theme support
- App shell refresh with shared header / sidebar / main layout
- Shared UI primitives for controls, badges, cards, tables, and notifications
- Existing JSON/spec/text/scenario/folder workflows preserved on top of the new visual foundation
- JSON rich viewer with semantic path/value diff table and raw output fallback
- Path-grouped JSON rich viewer with collapsible sections and compact value rendering
- Shared compare result toolbar primitives and JSON viewer UI alignment with text compare
- Shared compare workspace primitives for compare-centric modes, with text compare as the baseline and JSON compare aligned onto the same result/source shell
- Shared compare source actions, path slots, and result shell surfaces across compare-centric modes
- Shared compare interaction primitives for compare-centric modes, including source actions, source body variants, header actions, and result status surfaces
- JSON input workspace aligned with text compare, supporting file load, paste/edit, copy, and semantic rich compare from editor content
- OpenAPI spec rich viewer with grouped semantic sections, canonical path detail, and rich/raw fallback on the shared compare workspace
- Code-editor input for JSON and OpenAPI spec compare, with syntax highlighting and pane-local parse feedback
- Theme-aware viewer tokens and responsive sidebar toggle for narrower window widths
- Compact density pass and adaptive layout polish for narrower non-fullscreen window sizes
- Text compare dense controls with icon-based editor actions and resizable desktop sidebar
- Mode-aware layout: compare-centric modes use main-first workspace layout, while folder/scenario keep sidebar-driven workflow layout

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
- Text compare uses compact icon actions per editor (`Open`, `Paste`, `Copy`, `Clear`) and a `Copy raw output` icon action in the result toolbar
- Text rich diff supports `Unified` / `Split` view toggle
- Text rich diff keeps omitted unchanged sections collapsed by default, with per-section and global expand/collapse controls
- Text rich diff supports row search with next/prev navigation and auto-reveal of the active hidden unchanged section
- Folder compare MVP with recursive directory scan, flat result list, and child compare launch
- Folder compare workflow polish with scanned/visible summaries, quick filters, and selected-row detail pane
- Folder compare now uses a simpler table-first workflow inspired by WinMerge, with inline summaries and selected-row detail below the list
- Folder compare supports navigable directory listing with breadcrumb/up navigation, current-folder view, and file-to-diff flow
- Folder compare supports row interaction with double-click directory navigation and file-to-diff flow

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

Use Browse... in file-based modes to select local files. Text mode supports paste-first input and per-editor open/paste actions.
Folder compare is desktop-only in this phase and does not add a new CLI command yet.
For folder compare sample data, use `examples/folder/basic` and `examples/folder/filters`.

## Build frontend only

```bash
cd apps/desktop
npm --prefix frontend run build
```
