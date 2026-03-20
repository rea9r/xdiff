# apidiff

API response diff tool written in Go.

`apidiff` compares JSON responses and reports differences with clear exit codes.

## Quick Start

```bash
go run ./cmd/apidiff testdata/old.json testdata/new.json
```

Compare two URLs:

```bash
go run ./cmd/apidiff url https://old.example.com/api https://new.example.com/api
```

## Command Reference

Compare local JSON files:

```bash
apidiff [flags] old.json new.json
```

Compare JSON from URLs:

```bash
apidiff url [flags] <old-url> <new-url>
```

## Flags

Common flags (`apidiff` and `apidiff url`):

| Flag | Description | Default |
| --- | --- | --- |
| `--format text\|json` | Output format | `text` |
| `--scope diff\|both` | Output scope (`diff`: diff only, `both`: old/new + diff) | `diff` |
| `--view unified\|semantic` | Text diff style (`unified` is Git-like line diff) | `unified` |
| `--summary auto\|always\|never` | Summary visibility (`auto`: semantic=on, unified=off) | `auto` |
| `--ignore-path <path>` | Ignore exact diff path (repeatable) | none |
| `--only-breaking` | Show only breaking changes (`removed`, `type_changed`) | `false` |
| `--no-color` | Disable colored text output | `false` |

URL command only:

| Flag | Description | Default |
| --- | --- | --- |
| `--header "Key: Value"` | Add HTTP header (repeatable) | none |
| `--timeout <duration>` | Request timeout (`3s`, `1m`) | `5s` |

## Examples

Output JSON for CI:

```bash
go run ./cmd/apidiff --format json testdata/old.json testdata/new.json
```

Ignore noisy fields:

```bash
go run ./cmd/apidiff --ignore-path user.updated_at --ignore-path meta.request_id testdata/old.json testdata/new.json
```

Show only breaking changes:

```bash
go run ./cmd/apidiff --only-breaking testdata/old.json testdata/new.json
```

Show full context (old/new + diff):

```bash
go run ./cmd/apidiff --scope both testdata/old.json testdata/new.json
```

Use semantic diff view (path-based):

```bash
go run ./cmd/apidiff --view semantic testdata/old.json testdata/new.json
```

Force summary on unified view:

```bash
go run ./cmd/apidiff --view unified --summary always testdata/old.json testdata/new.json
```

URL comparison with auth header and timeout:

```bash
go run ./cmd/apidiff url --timeout 3s --header "Authorization: Bearer xxx" https://old.example.com/api https://new.example.com/api
```

## Exit Codes

- `0`: no differences
- `1`: differences found
- `2`: execution error

## Development

```bash
go fmt ./...
go test ./...
go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.11.3 run --config=.golangci.yml
```
