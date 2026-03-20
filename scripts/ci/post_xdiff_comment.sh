#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "usage: $0 <repo> <pr-number> <success-artifact-dir> <failure-artifact-dir>" >&2
}

parse_args() {
  if [ "$#" -ne 4 ]; then
    usage
    exit 2
  fi

  repo="$1"
  pr_number="$2"
  success_dir="$3"
  failure_dir="$4"
}

read_case_data() {
  success_summary="$(jq '.summary // {}' "$success_dir/result.json")"
  success_top_diffs="$(jq '(.diffs // [])[:3]' "$success_dir/result.json")"
  success_expected="$(cat "$success_dir/expected_exit.txt")"
  success_observed="$(cat "$success_dir/exit_code.txt")"

  failure_summary="$(jq '.summary // {}' "$failure_dir/result.json")"
  failure_top_diffs="$(jq '(.diffs // [])[:3]' "$failure_dir/result.json")"
  failure_expected="$(cat "$failure_dir/expected_exit.txt")"
  failure_observed="$(cat "$failure_dir/exit_code.txt")"
}

build_comment_body() {
  marker="<!-- xdiff-example-report -->"
  body_file="$(mktemp)"
  payload_file="$(mktemp)"

  {
    echo "$marker"
    echo "## xdiff example report"
    echo
    echo "| Case | Expected | Observed |"
    echo "| --- | --- | --- |"
    echo "| Non-breaking pass | \`${success_expected}\` | \`${success_observed}\` |"
    echo "| Breaking-change detection | \`${failure_expected}\` | \`${failure_observed}\` |"
    echo
    echo "<details><summary>Success case summary</summary>"
    echo
    echo '```json'
    echo "$success_summary"
    echo '```'
    echo "</details>"
    echo
    echo "<details><summary>Success case top diffs (up to 3)</summary>"
    echo
    echo '```json'
    echo "$success_top_diffs"
    echo '```'
    echo "</details>"
    echo
    echo "<details><summary>Failure case summary</summary>"
    echo
    echo '```json'
    echo "$failure_summary"
    echo '```'
    echo "</details>"
    echo
    echo "<details><summary>Failure case top diffs (up to 3)</summary>"
    echo
    echo '```json'
    echo "$failure_top_diffs"
    echo '```'
    echo "</details>"
  } > "$body_file"

  jq -Rs '{body: .}' < "$body_file" > "$payload_file"
}

upsert_comment() {
  comments_json="$(mktemp)"
  gh api "repos/${repo}/issues/${pr_number}/comments" > "$comments_json"
  comment_id="$(
    jq -r '.[] | select((.body // "") | contains("<!-- xdiff-example-report -->")) | .id' "$comments_json" | head -n 1
  )"

  if [ -n "$comment_id" ]; then
    gh api \
      --method PATCH \
      -H "Accept: application/vnd.github+json" \
      "repos/${repo}/issues/comments/${comment_id}" \
      --input "$payload_file" >/dev/null
    return
  fi

  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "repos/${repo}/issues/${pr_number}/comments" \
    --input "$payload_file" >/dev/null
}

main() {
  parse_args "$@"
  read_case_data
  build_comment_body
  upsert_comment
}

main "$@"
