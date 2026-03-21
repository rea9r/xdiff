# xdiff

Data diff tool written in Go.

`xdiff` compares JSON/text/OpenAPI inputs and reports differences with clear exit codes.

## Quick Start

Try it from the repository root:

```bash
go run ./cmd/xdiff testdata/old.json testdata/new.json
```

Install once:

```bash
go install ./cmd/xdiff
```

Then compare your own files:

```bash
xdiff old.json new.json
```

Compare two URLs:

```bash
xdiff url https://old.example.com/api https://new.example.com/api
```

> This README uses **options** for named command-line settings such as `--output-format`.
> Cobra help may refer to the same settings as **flags**.

## Command Reference

Compare local JSON files:

```bash
xdiff [options] old.json new.json
```

Arguments:
- `old.json`: base JSON file
- `new.json`: JSON file to compare

Compare local text files:

```bash
xdiff text [options] old.txt new.txt
```

Arguments:
- `old.txt`: base text file
- `new.txt`: text file to compare

Compare JSON from URLs:

```bash
xdiff url [options] <old-url> <new-url>
```

Arguments:
- `<old-url>`: base endpoint URL
- `<new-url>`: endpoint URL to compare

Notes:
- Requests are sent with `GET`.
- Comparison uses the decoded JSON response body.
- Both responses must be `2xx`.
- Response headers and status codes are not diff targets.

Compare OpenAPI specs (JSON or YAML):

```bash
xdiff spec [options] <old-spec> <new-spec>
```

Arguments:
- `<old-spec>`: base OpenAPI spec file
- `<new-spec>`: OpenAPI spec file to compare

## Options

Common options (`xdiff`, `xdiff text`, `xdiff url`, and `xdiff spec`):

| Option | Description | Default |
| --- | --- | --- |
| `--output-format text\|json` | Output format | `text` |
| `--fail-on none\|breaking\|any` | Exit code policy (`none`: always 0, `breaking`: fail only on breaking changes, `any`: fail on any diff) | `any` |
| `--ignore-path <path>` | Ignore an exact canonical diff path (repeatable) | none |
| `--only-breaking` | Show only breaking changes (`removed`, `type_changed`) | `false` |
| `--text-style auto\|patch\|semantic` | Text rendering style for `--output-format text` | `auto` |
| `--no-color` | Disable colored text output | `false` |

JSON comparison options (`xdiff`, `xdiff url`):

| Option | Description | Default |
| --- | --- | --- |
| `--ignore-order` | Treat JSON arrays as unordered when comparing | `false` |

URL-specific options:

| Option | Description | Default |
| --- | --- | --- |
| `--header "Key: Value"` | Add HTTP header (repeatable) | none |
| `--timeout <duration>` | Request timeout (`3s`, `1m`) | `5s` |

## Examples

Output JSON for CI:

```bash
xdiff --output-format json old.json new.json
```

Ignore noisy fields:

```bash
xdiff --ignore-path user.updated_at --ignore-path meta.request_id old.json new.json
```

Show only breaking changes:

```bash
xdiff --only-breaking old.json new.json
```

Compare text files:

```bash
xdiff text before.txt after.txt
```

Fail only when breaking changes are detected:

```bash
xdiff --fail-on breaking old.json new.json
```

URL comparison with auth header and timeout:

```bash
xdiff url --timeout 3s --header "Authorization: Bearer xxx" https://old.example.com/api https://new.example.com/api
```

URL comparison compares JSON response bodies returned by `GET` requests.
Non-2xx responses are treated as execution errors.

OpenAPI spec comparison (JSON or YAML):

```bash
xdiff spec --fail-on breaking old-openapi.yaml new-openapi.yaml
```

Ignore array order in local JSON comparison:

```bash
xdiff --ignore-order old.json new.json
```

Ignore array order in URL comparison:

```bash
xdiff url --ignore-order https://old.example.com/api https://new.example.com/api
```

For OpenAPI comparison, `--ignore-path` matches canonical paths such as:

- `paths./users.post`
- `paths./users.post.requestBody.required`
- `paths./users.get.responses.200.content.application/json.schema.type`

Text output may show human-readable OpenAPI labels, but `--ignore-path` and `--output-format json` use canonical paths.

Notes for `--ignore-order`:
- Arrays are compared as unordered normalized values.
- This does not perform ID-based object matching.
- Diff indices may reflect normalized comparison order rather than original source order.

Notes for `--text-style`:
- `auto` keeps the current behavior.
- `patch` uses unified patch output when that style is supported.
- `semantic` always renders structured diffs.
- `patch` is invalid for `xdiff spec`, and also invalid with semantic-only filters such as `--ignore-path`, `--only-breaking`, or `--ignore-order`.
- For incompatible combinations, the CLI prints a suggested next step.

Force semantic text output for JSON comparison:

```bash
xdiff --text-style semantic old.json new.json
```

Force patch-style text output for plain text comparison:

```bash
xdiff text --text-style patch before.txt after.txt
```

Use semantic text output for OpenAPI comparison:

```bash
xdiff spec --text-style semantic old-openapi.yaml new-openapi.yaml
```

Current `spec` comparison scope:
- path/method added or removed
- `requestBody.required` changes
- response schema `type` changes (per status/content type)

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

## CI Example (GitHub Actions)

This repository includes a working example workflow: [`.github/workflows/xdiff-example.yml`](.github/workflows/xdiff-example.yml)
- It runs `xdiff url` against two mock HTTP APIs inside CI.
- Mock API startup and comparison logic is shared via `scripts/ci/mock_api_compare.sh`.
- Consolidated PR comment logic is shared via `scripts/ci/post_xdiff_comment.sh`.
- Success/failure example cases are implemented as a matrix job for maintainability.
- It includes a success case (`non-breaking`, expected exit code `0`).
- It includes a failure-detection case (`breaking`, expected exit code `1`).
- It publishes JSON outputs as workflow artifacts.
- It writes observed/expected exit codes and JSON output to Job Summary.
- On pull requests, it posts/updates a single consolidated PR comment with both cases.
- The PR comment includes summaries and top diffs (up to 3) for each case.
- On direct pushes to `main`, it runs without PR comments and keeps results in artifacts/summary.

For practical production patterns, see:
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

Use the workflow file as the source of truth for a runnable setup.

## Development

```bash
go fmt ./...
go test ./...
go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.11.3 run --config=.golangci.yml
```
