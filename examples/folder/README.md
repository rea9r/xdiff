# Folder Compare Fixtures (Desktop-only)

These fixtures are intended for the desktop Folder Compare workflow.
They are not CLI runnable examples because folder compare is desktop-only in the current phase.

## Sets

- `basic`: status coverage and child compare launch (`text` / `json`)
- `filters`: `show same`, `name filter`, quick filters, and scanned/visible summary checks

## How to use in desktop app

1. Start desktop app (`wails dev`) from `apps/desktop`.
2. Switch mode to **Folder Compare**.
3. Pick left/right roots from one fixture set.

### Basic fixture roots

- Left: `examples/folder/basic/left`
- Right: `examples/folder/basic/right`

Expected highlights:

- `same`, `changed`, `left-only`, `right-only`, `type-mismatch`
- `api/payload.json` can open JSON compare
- `.txt` changed rows can open text compare

### Filters fixture roots

- Left: `examples/folder/filters/left`
- Right: `examples/folder/filters/right`

Try:

- `show same = off`
- `name filter = src`
- quick filters (`Changed`, `Same`, etc.)
- check scanned vs visible summary counts
