# xdiff Desktop (Wails, Phase 7D-1.5)

This app is an experimental desktop GUI for xdiff.

## Scope (Phase 7D-1.5)

- Mantine-based visual foundation with light / dark / system theme support
- App shell refresh with shared header / sidebar / main layout
- Shared UI primitives for controls, badges, cards, tables, and notifications
- Existing JSON/spec/text/scenario/directory workflows preserved on top of the new visual foundation
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
- Mode-aware layout: compare-centric modes use main-first workspace layout, while directory/scenario keep sidebar-driven workflow layout

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
- Directory compare MVP with recursive directory scan, flat result list, and child compare launch
- Directory compare workflow polish with scanned/visible summaries, quick filters, and selected-row detail pane
- Directory compare now uses a simpler table-first workflow inspired by WinMerge, with inline summaries and selected-row detail below the list
- Directory compare supports navigable directory listing with breadcrumb/up navigation, current-directory view, and file-to-diff flow
- Directory compare supports row interaction with double-click directory navigation and file-to-diff flow
- Directory compare supports sortable columns and keyboard navigation in the current-directory table view
- Directory compare supports both list and lazy tree views on top of the current-directory workflow
- Directory compare list/tree views use a lighter, denser result presentation aligned with other compare screens
- Directory compare uses a compact main-first workflow with current-path header, breadcrumb/up navigation, and table-first list/tree switching
- Directory compare uses a compact main-first header with clickable breadcrumb navigation and always-visible left/right root context
- Directory compare uses always-visible left/right root selectors with input-like fields, compact list/tree toggle, and a scrollable table-first result area
- Directory compare uses a split context/result header pattern, with current-path breadcrumb near the title and list/tree/filter controls above the result list
- Opening a diff from directory compare preserves a return path back to the directory workflow context
- Directory compare separates context (title + breadcrumb + roots) from result controls (summary + list/tree + filters), and keeps a visible return path from child diff views
- Unified compare result model across text/json/spec, with `Diff` as the default display and `Semantic`/`Raw` as secondary views where applicable
- Persistent last-session restore for desktop compare workflows (paths/roots/options) without persisting editor text or diff output
- Recent compare/scenario/directory targets with lightweight history recall and per-mode clear actions

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
Directory compare is desktop-only in this phase and does not add a new CLI command yet.
For directory compare sample data, use `examples/folder/basic` and `examples/folder/filters`.

## Build frontend only

In a clean environment, generate Wails bindings once before the frontend build.

```bash
cd apps/desktop
wails generate module
npm --prefix frontend run build
```
