# UX Scenarios

Use these scenarios as a lightweight user-facing quality loop.

## Goal

Verify that `xdiff` helps users answer three questions quickly:
- Did the check pass or fail?
- Why did it pass or fail?
- What changed (and what matters)?

## Scenario 1: File diff (everyday local check)

Command:

```bash
xdiff testdata/old.json testdata/new.json
```

Checkpoints:
- Diff output starts with unified headers (`--- old`, `+++ new`)
- Diff body is still readable (Git-style patch)

## Scenario 2: URL diff (runtime behavior check)

Command:

```bash
xdiff url https://old.example.com/api https://new.example.com/api
```

Checkpoints:
- Network errors are actionable
- Exit code behavior matches `--fail-on` mode

## Scenario 3: OpenAPI spec diff (contract review)

Command:

```bash
xdiff spec --fail-on breaking openapi-old.yaml openapi-new.yaml
```

Checkpoints:
- Method-level changes are human-readable (`METHOD /path`)
- Contract-impacting changes are easy to spot in text output

## Scenario 4: CI-friendly JSON mode

Command:

```bash
xdiff --format json --fail-on breaking testdata/old.json testdata/new.json
```

Checkpoints:
- JSON structure is stable for automation
- Exit code policy matches `--fail-on` mode

## Review Cadence

- Run all scenarios before release-oriented commits.
- If output changes, update snapshots/examples in `README.md`.
- Prefer small UX improvements with measurable impact on these scenarios.
