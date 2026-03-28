# Folder Fixture: filters

This fixture is for validating filter workflow in Folder Compare.

## Left root

`examples/folder/filters/left`

## Right root

`examples/folder/filters/right`

## Dataset intent

- `src/app.txt`: `changed`
- `src/config.json`: `changed`
- `docs/overview.md`: `same`
- `tests/sample.txt`: `same`

## Suggested checks

- With `show same` enabled, verify scanned and visible totals match.
- With `show same` disabled, verify visible summary removes `same` entries.
- Set `name filter` to `src` and verify visible entries are only `src/*`.
- Use quick filters to switch between `Changed` and `Same` rows.
