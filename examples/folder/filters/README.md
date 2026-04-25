# Folder Fixture: filters

This fixture validates the filter workflow in Folder Compare with
a wider mix of files across `src/`, `docs/`, and `tests/`.

## Left root

`examples/folder/filters/left`

## Right root

`examples/folder/filters/right`

## Dataset intent

### `same`

- `README.md`
- `docs/overview.md`, `docs/guide.md`
- `src/helper.txt`
- `tests/sample.txt`

### `changed`

- `src/app.txt`, `src/config.json`, `src/service.json`
- `docs/changelog.md`
- `tests/smoke.txt`, `tests/regression.json`

### `left-only`

- `src/old-handler.txt`
- `docs/draft.md`
- `tests/old-fixture.txt`

### `right-only`

- `src/new-handler.txt`
- `docs/release.md`
- `tests/new-fixture.txt`

## Suggested checks

- With `show same` enabled, verify scanned and visible totals match.
- With `show same` disabled, verify visible summary removes `same` entries.
- Set `name filter` to `src` and verify visible entries are only `src/*`.
- Set `name filter` to `*.json` (or `json`) and verify only JSON rows show.
- Use quick filters to switch between `Changed`, `Same`, `Left-only`,
  `Right-only` rows and verify counts.
