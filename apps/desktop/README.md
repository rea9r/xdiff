# xdiff Desktop

A WinMerge-style desktop GUI for `xdiff`, built with Wails (Go) + React + Mantine.

## Supported workflows

- **JSON compare**: file load or paste-edit input, semantic rich diff with grouped path/value table, and raw output fallback.
- **Text compare**: paste-first input with per-editor open/paste/copy/clear actions, rich diff with `Unified` / `Split` view toggle, collapsible unchanged sections, and row search with next/prev navigation.
- **Folder compare**: recursive directory scan with table-first list/tree views, breadcrumb navigation, scanned/visible summaries, quick filters, sortable columns, and child compare launch into JSON or text diff.
- **Shared compare workspace**: unified result model with `Diff` as the default view and `Semantic` / `Raw` as secondary views where applicable.
- **Theming**: light / dark / system theme support with theme-aware viewer tokens and responsive sidebar that collapses for narrower windows.
- **Persistence**: last-session restore (paths/roots/options) and recent compare/folder targets with per-mode clear actions. Editor text and diff output are not persisted.

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

For folder compare sample data, use `examples/folder/basic` and `examples/folder/filters`.

## Build frontend only

In a clean environment, generate Wails bindings once before the frontend build.

```bash
cd apps/desktop
wails generate module -tags wailsbindings
npm --prefix frontend run build
```
