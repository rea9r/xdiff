# xdiff

A general-purpose diff tool for JSON, plain text, and folders. Inspired by WinMerge and built in Go.

## Overview

`xdiff` ships in two forms:

- **CLI** for scripting local file comparisons (`xdiff json`, `xdiff text`).
- **Desktop GUI** (Wails + React) for interactive JSON / text / folder compare workflows.

## Quick Start

Try it from the repository root:

```bash
go run ./cmd/xdiff json examples/json/old.json examples/json/new.json
```

Install once:

```bash
go install ./cmd/xdiff
```

Then compare your own files:

```bash
xdiff json old.json new.json
xdiff text before.txt after.txt
```

## Commands

List commands and usage:

```bash
xdiff
```

Compare local JSON files:

```bash
xdiff json [options] <old-file> <new-file>
```

Arguments:
- `<old-file>`: base file containing JSON
- `<new-file>`: file containing JSON to compare

Compare local text files:

```bash
xdiff text [options] <old-file> <new-file>
```

Arguments:
- `<old-file>`: base plain-text file
- `<new-file>`: plain-text file to compare

## Options

Common options (`xdiff json` and `xdiff text`):

| Option | Description | Default |
| --- | --- | --- |
| `--output-format text\|json` | Output format | `text` |
| `--ignore-path <path>` | Ignore an exact canonical diff path (repeatable) | none |
| `--show-paths` | Print canonical diff paths only (useful with `--ignore-path`) | `false` |
| `--text-style auto\|patch\|semantic` | Text rendering style for `--output-format text` | `auto` |
| `--no-color` | Disable colored text output | `false` |

JSON-specific options (`xdiff json`):

| Option | Description | Default |
| --- | --- | --- |
| `--ignore-order` | Treat JSON arrays as unordered when comparing | `false` |

> This README uses **options** for named command-line settings such as `--output-format`.
> Cobra help may refer to the same settings as **flags**.

## Behavior Notes

### Canonical Diff Paths

`--ignore-path` matches canonical diff paths exactly. Use `--show-paths` to print only the paths so you can identify which entries to ignore.

### `--ignore-order`

- Arrays are compared as unordered normalized values.
- This does not perform ID-based object matching.
- Diff indices may reflect normalized comparison order rather than original source order.

### `--text-style`

- `auto` keeps the current behavior.
- `patch` uses unified patch output when that style is supported.
- `semantic` always renders structured diffs.
- `patch` is invalid with semantic-only filters such as `--ignore-path` or `--ignore-order`.
- For incompatible combinations, the CLI prints a suggested next step.

## Runnable examples

Small runnable examples are available under:

- `examples/json`
- `examples/text`

## Desktop fixture examples

Desktop-only fixture sets for the Folder Compare workflow:

- `examples/folder/basic`
- `examples/folder/filters`

## Examples

Compare local JSON files:

```bash
xdiff json old.json new.json
```

Compare local text files:

```bash
xdiff text before.txt after.txt
```

Output JSON for scripting:

```bash
xdiff json --output-format json old.json new.json
```

Ignore noisy fields:

```bash
xdiff json --ignore-path user.updated_at --ignore-path meta.request_id old.json new.json
```

Show canonical diff paths for local JSON comparison:

```bash
xdiff json --show-paths old.json new.json
```

Ignore array order in local JSON comparison:

```bash
xdiff json --ignore-order old.json new.json
```

Force semantic text output for JSON comparison:

```bash
xdiff json --text-style semantic old.json new.json
```

Force patch-style text output for plain text comparison:

```bash
xdiff text --text-style patch before.txt after.txt
```

## Output Samples

Default output (GitHub-like patch):

```diff
--- old
+++ new
@@ -1,12 +1,13 @@
 {
   "items": [
     "a",
-    "b"
+    "c",
+    "d"
   ],
   "user": {
-    "age": "20",
-    "email": "taro@example.com",
-    "name": "Taro"
+    "age": 20,
+    "name": "Hanako",
+    "phone": "090-xxxx-xxxx"
   }
 }
```

Machine-readable output (`--output-format json`):

```json
{
  "diffs": [
    {
      "type": "changed",
      "path": "items[1]",
      "old_value": "b",
      "new_value": "c"
    },
    {
      "type": "added",
      "path": "items[2]",
      "new_value": "d"
    },
    {
      "type": "removed",
      "path": "user.email",
      "old_value": "taro@example.com"
    },
    {
      "type": "type_changed",
      "path": "user.age",
      "old_value": "20",
      "new_value": 20,
      "old_type": "string",
      "new_type": "number"
    },
    {
      "type": "changed",
      "path": "user.name",
      "old_value": "Taro",
      "new_value": "Hanako"
    },
    {
      "type": "added",
      "path": "user.phone",
      "new_value": "090-xxxx-xxxx"
    }
  ],
  "summary": {
    "added": 2,
    "removed": 1,
    "changed": 2,
    "type_changed": 1
  }
}
```

## Exit Codes

`xdiff` follows `diff(1)` conventions:

- `0`: no differences
- `1`: differences found
- `2`: execution error

## Desktop App

A WinMerge-style desktop GUI lives under `apps/desktop/`. See `apps/desktop/README.md` for setup and the supported JSON / text / folder compare workflows.

## Development

```bash
go fmt ./...
go test ./...
go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.11.3 run --config=.golangci.yml
```
