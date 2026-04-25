# Folder Fixture: basic

This fixture validates Folder Compare status coverage, child compare
launch, and scrolling behavior with a moderately-sized tree.

## Left root

`examples/folder/basic/left`

## Right root

`examples/folder/basic/right`

## Status coverage

Each status has multiple representatives so the row list shows
realistic mixing.

### `same`

- `README.md`
- `same.txt`
- `docs/guide.md`
- `src/main.go`
- `api/users.json`
- `nested/same-nested.txt`
- `nested/deep/deep-same.txt`

### `changed`

- `VERSION`
- `changed.txt`
- `docs/overview.md`
- `src/app.go`
- `src/util.go`
- `api/payload.json`
- `api/orders.json`
- `nested/changed-nested.txt`
- `nested/deep/deep-changed.txt`

### `left-only`

- `left-only.txt`
- `docs/draft.md`
- `src/legacy.go`
- `api/legacy.json`
- `nested/deep/deep-left-only.txt`

### `right-only`

- `right-only.txt`
- `docs/ROADMAP.md`
- `src/service.go`
- `api/proxy.json`
- `nested/deep/deep-right-only.txt`

### `type-mismatch`

- `type-mismatch-target` (left file vs right directory)

## Child compare launch

The following entries have substantial content so launching a
child compare exercises the diff viewer (including the overview
ruler) with more than a handful of marks:

- `changed.txt`, `nested/changed-nested.txt`
- `docs/overview.md`
- `src/app.go`, `src/util.go`
- `api/payload.json`, `api/orders.json`
