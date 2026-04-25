# Folder Fixture: basic

This fixture is for validating Folder Compare status coverage and child compare launch.

## Left root

`examples/folder/basic/left`

## Right root

`examples/folder/basic/right`

## Expected statuses

- `same.txt`: `same`
- `changed.txt`: `changed`
- `left-only.txt`: `left-only`
- `right-only.txt`: `right-only`
- `nested/same-nested.txt`: `same` (recursive)
- `nested/changed-nested.txt`: `changed` (recursive)
- `type-mismatch-target`: `type-mismatch` (left file vs right directory)

## Child compare launch checks

- `api/payload.json`: JSON compare hint
- `changed.txt` / `nested/changed-nested.txt`: Text compare hint
