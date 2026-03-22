# xdiff

Data diff tool written in Go.

## Overview

`xdiff` compares JSON, plain text, OpenAPI specs, and JSON responses from URLs, and reports differences with clear exit codes.

## Quick Start

Try it from the repository root:

```bash
go run ./cmd/xdiff json testdata/old.json testdata/new.json
```

The root `testdata/old.json` and `testdata/new.json` files are quick-start fixtures. Package-specific test fixtures are kept under each package's own `testdata/` directory.

Install once:

```bash
go install ./cmd/xdiff
```

Then compare your own files:

```bash
xdiff json old.json new.json
```

Compare two URLs:

```bash
xdiff url https://old.example.com/api https://new.example.com/api
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

Compare JSON from URLs:

```bash
xdiff url [options] <old-url> <new-url>
```

Arguments:
- `<old-url>`: base endpoint URL
- `<new-url>`: endpoint URL to compare

Compare OpenAPI specs (JSON or YAML):

```bash
xdiff spec [options] <old-spec> <new-spec>
```

Arguments:
- `<old-spec>`: base OpenAPI spec file
- `<new-spec>`: OpenAPI spec file to compare

Run multiple checks from a scenario file:

```bash
xdiff run [options] <scenario-file>
```

Arguments:
- `<scenario-file>`: YAML file that defines multiple checks

## Options

Common options (`xdiff json`, `xdiff text`, `xdiff url`, and `xdiff spec`):

| Option | Description | Default |
| --- | --- | --- |
| `--output-format text\|json` | Output format | `text` |
| `--fail-on none\|breaking\|any` | Exit code policy (`none`: always 0, `breaking`: fail only on breaking changes, `any`: fail on any diff) | `any` |
| `--ignore-path <path>` | Ignore an exact canonical diff path (repeatable) | none |
| `--show-paths` | Print canonical diff paths only (useful with `--ignore-path`) | `false` |
| `--only-breaking` | Show only breaking changes (`removed`, `type_changed`) | `false` |
| `--text-style auto\|patch\|semantic` | Text rendering style for `--output-format text` | `auto` |
| `--no-color` | Disable colored text output | `false` |

JSON comparison options (`xdiff json`, `xdiff url`):

| Option | Description | Default |
| --- | --- | --- |
| `--ignore-order` | Treat JSON arrays as unordered when comparing | `false` |

URL-specific options:

| Option | Description | Default |
| --- | --- | --- |
| `--header "Key: Value"` | Add HTTP header (repeatable) | none |
| `--timeout <duration>` | Request timeout (`3s`, `1m`) | `5s` |

Scenario-mode options (`xdiff run`):

| Option | Description | Default |
| --- | --- | --- |
| `--report-format text\|json` | Scenario report format | `text` |

> This README uses **options** for named command-line settings such as `--output-format`.
> Cobra help may refer to the same settings as **flags**.

## Behavior Notes

### URL Comparison

- Requests are sent with `GET`.
- Comparison uses the decoded JSON response body.
- Both responses must be `2xx`.
- Response headers and status codes are not diff targets.

### Canonical Diff Paths

`--ignore-path` matches canonical diff paths exactly.

For OpenAPI comparison, canonical paths include values such as:

- `paths./users.post`
- `paths./users.post.requestBody.required`
- `paths./users.get.responses.200.content.application/json.schema.type`

OpenAPI text output may show more human-readable labels, but:

- `--ignore-path`
- `--output-format json`
- `--show-paths`

all use canonical paths.

### `--ignore-order`

- Arrays are compared as unordered normalized values.
- This does not perform ID-based object matching.
- Diff indices may reflect normalized comparison order rather than original source order.

### `--text-style`

- `auto` keeps the current behavior.
- `patch` uses unified patch output when that style is supported.
- `semantic` always renders structured diffs.
- `patch` is invalid for `xdiff spec`.
- `patch` is also invalid with semantic-only filters such as `--ignore-path`, `--only-breaking`, or `--ignore-order`.
- For incompatible combinations, the CLI prints a suggested next step.

### Current `spec` Comparison Scope

- path/method added or removed
- `requestBody.required` changes
- response schema `type` changes (per status/content type)

## Scenario Mode

Run multiple checks from one YAML file:

```bash
xdiff run xdiff.yaml
```

Minimal example:

```yaml
version: 1

defaults:
  fail_on: any
  text_style: auto

checks:
  - name: local-user-json
    kind: json
    old: snapshots/old-user.json
    new: snapshots/new-user.json
    ignore_paths:
      - user.updated_at
    ignore_order: true

  - name: public-contract
    kind: spec
    old: specs/old-openapi.yaml
    new: specs/new-openapi.yaml
    only_breaking: true

  - name: live-user-url
    kind: url
    old: https://old.example.com/api/user
    new: https://new.example.com/api/user
    headers:
      - Authorization: Bearer xxx
    timeout: 3s
```

Notes:
- Supported check kinds: `json`, `text`, `url`, `spec`.
- Local file paths are resolved relative to the scenario file directory.
- `--report-format` controls scenario report output (`text` or `json`).
- Scenario exit codes:
  - `2`: at least one check has an execution error
  - `1`: no execution errors, but at least one check reports differences
  - `0`: all checks are OK

## Examples

Compare local JSON files:

```bash
xdiff json old.json new.json
```

Compare local text files:

```bash
xdiff text before.txt after.txt
```

Compare URL response bodies:

```bash
xdiff url https://old.example.com/api https://new.example.com/api
```

Compare OpenAPI specs:

```bash
xdiff spec old-openapi.yaml new-openapi.yaml
```

Fail only when breaking changes are detected:

```bash
xdiff json --fail-on breaking old.json new.json
```

Output JSON for CI or scripting:

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

Ignore array order in URL comparison:

```bash
xdiff url --ignore-order https://old.example.com/api https://new.example.com/api
```

Compare URL response bodies with an auth header and timeout:

```bash
xdiff url --timeout 3s --header "Authorization: Bearer xxx" https://old.example.com/api https://new.example.com/api
```

Force semantic text output for JSON comparison:

```bash
xdiff json --text-style semantic old.json new.json
```

Force patch-style text output for plain text comparison:

```bash
xdiff text --text-style patch before.txt after.txt
```

Show canonical diff paths for OpenAPI comparison:

```bash
xdiff spec --show-paths old-openapi.yaml new-openapi.yaml
```

Show only breaking canonical paths for OpenAPI comparison:

```bash
xdiff spec --only-breaking --show-paths old-openapi.yaml new-openapi.yaml
```

Use semantic text output for OpenAPI comparison:

```bash
xdiff spec --text-style semantic old-openapi.yaml new-openapi.yaml
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

- `0`: no differences
- `1`: differences found (based on `--fail-on` policy)
- `2`: execution error

## CI

This repository includes a working example workflow:

- [`.github/workflows/xdiff-example.yml`](.github/workflows/xdiff-example.yml)

Related helpers and docs:

- [`scripts/ci/mock_api_compare.sh`](scripts/ci/mock_api_compare.sh)
- [`scripts/ci/post_xdiff_comment.sh`](scripts/ci/post_xdiff_comment.sh)
- [`docs/ci-use-cases.md`](docs/ci-use-cases.md)
- [`docs/ux-scenarios.md`](docs/ux-scenarios.md)

Core command used in the workflow:

```bash
xdiff url \
  --output-format json \
  --fail-on breaking \
  http://127.0.0.1:18081/user.json \
  http://127.0.0.1:18082/user.json > xdiff-result.json
```

Use the workflow file as the source of truth for a runnable CI setup.

## Development

```bash
go fmt ./...
go test ./...
go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.11.3 run --config=.golangci.yml
```
