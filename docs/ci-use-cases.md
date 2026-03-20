# CI Use Cases

Practical CI patterns for using `apidiff` in production workflows.

## 1. Protect backward compatibility in pull requests (recommended)

Use case:
- When API behavior changes in a PR, fail the pipeline only for client-breaking changes.

Approach:
- `old.json`: compatibility baseline response (typically from `main`)
- `new.json`: response from the PR branch
- Use `--fail-on breaking` so only `removed` / `type_changed` fail the job.

```yaml
name: api-contract-guard

on:
  pull_request:

jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-go@v6
        with:
          go-version: "1.26"

      - run: go install ./cmd/apidiff

      - name: Start API (example)
        run: |
          docker compose up -d api
          sleep 5

      - name: Fetch baseline/current responses
        run: |
          curl -fsS "http://localhost:8080/api/v1/users/1?profile=old" -o old.json
          curl -fsS "http://localhost:8080/api/v1/users/1?profile=new" -o new.json

      - name: Fail only on breaking changes
        run: |
          apidiff \
            --format json \
            --fail-on breaking \
            old.json \
            new.json > apidiff-result.json
```

## 2. Monitor drift between staging and production (reporting use case)

Use case:
- Detect response drift between staging and production on a schedule.
- Report differences without immediately failing the pipeline.

Approach:
- Use `--fail-on none` to keep the job green.
- Save JSON output as an artifact for review.

```yaml
name: api-drift-report

on:
  schedule:
    - cron: "0 * * * *"
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-go@v6
        with:
          go-version: "1.26"

      - run: go install ./cmd/apidiff

      - name: Compare staging/prod
        run: |
          apidiff url \
            --format json \
            --fail-on none \
            --header "Authorization: Bearer ${{ secrets.API_TOKEN }}" \
            "https://stg.example.com/api/v1/users/1" \
            "https://api.example.com/api/v1/users/1" > apidiff-result.json

      - name: Upload diff result
        uses: actions/upload-artifact@v6
        with:
          name: apidiff-result
          path: apidiff-result.json
```

## Operational tips

- Start with `--fail-on breaking`.
- Use `--ignore-path` for noisy fields such as `updated_at` or `request_id`.
- Use `text` output for humans and `json` output for CI integrations.
