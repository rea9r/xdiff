# Folder Compare Fixtures (Desktop-only)

These fixtures are intended for the desktop Folder Compare workflow.
They are not CLI runnable examples because folder compare is
desktop-only in the current phase.

## Sets

- `basic`: status coverage (`same`, `changed`, `left-only`,
  `right-only`, `type-mismatch`), nested folders, and child compare
  launch (`text` / `json`). Several `changed` entries have
  substantial content so the diff viewer renders many marks.
- `filters`: `show same`, `name filter`, and quick filters.
  Multiple `src/`, `docs/`, `tests/` entries per status to make the
  scanned/visible summary numbers meaningful.

## How to use in desktop app

1. Start desktop app (`wails dev`) from `apps/desktop`.
2. Switch mode to **Folder Compare**.
3. Pick left/right roots from one fixture set.

### Basic fixture roots

- Left: `examples/folder/basic/left`
- Right: `examples/folder/basic/right`

See [`basic/README.md`](basic/README.md) for the full status table.

### Filters fixture roots

- Left: `examples/folder/filters/left`
- Right: `examples/folder/filters/right`

See [`filters/README.md`](filters/README.md) for filter check
suggestions.
