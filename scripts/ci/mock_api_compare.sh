#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "usage: $0 <non-breaking|breaking> <output-json-path>" >&2
}

parse_args() {
  if [ "$#" -ne 2 ]; then
    usage
    exit 2
  fi

  scenario="$1"
  output_path="$2"
}

set_payloads() {
  case "$scenario" in
    non-breaking)
      old_payload='{"user":{"name":"Taro","age":"20"}}'
      new_payload='{"user":{"name":"Hanako","age":"20"}}'
      ;;
    breaking)
      old_payload='{"user":{"name":"Taro","age":"20","email":"taro@example.com"}}'
      new_payload='{"user":{"name":"Hanako","age":"20","phone":"090-xxxx-xxxx"}}'
      ;;
    *)
      echo "invalid scenario: $scenario (allowed: non-breaking, breaking)" >&2
      exit 2
      ;;
  esac
}

cleanup() {
  kill "${old_pid:-}" "${new_pid:-}" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
}

wait_for_server() {
  local url="$1"
  local log_file="$2"
  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null; then
      return 0
    fi
    sleep 0.2
  done

  echo "server did not become ready: $url" >&2
  echo "--- $log_file ---" >&2
  cat "$log_file" >&2 || true
  return 1
}

start_mock_servers() {
  work_dir="$(mktemp -d)"
  old_dir="$work_dir/old-api"
  new_dir="$work_dir/new-api"
  old_log="$work_dir/old-api.log"
  new_log="$work_dir/new-api.log"
  old_port=18081
  new_port=18082

  trap cleanup EXIT

  mkdir -p "$old_dir" "$new_dir"
  printf '%s\n' "$old_payload" > "$old_dir/user.json"
  printf '%s\n' "$new_payload" > "$new_dir/user.json"

  python3 -m http.server "$old_port" --bind 127.0.0.1 --directory "$old_dir" >"$old_log" 2>&1 &
  old_pid=$!
  python3 -m http.server "$new_port" --bind 127.0.0.1 --directory "$new_dir" >"$new_log" 2>&1 &
  new_pid=$!

  old_url="http://127.0.0.1:${old_port}/user.json"
  new_url="http://127.0.0.1:${new_port}/user.json"
}

run_xdiff() {
  wait_for_server "$old_url" "$old_log"
  wait_for_server "$new_url" "$new_log"

  set +e
  xdiff \
    url \
    --format json \
    --fail-on breaking \
    "$old_url" \
    "$new_url" > "$output_path"
  exit_code=$?
  set -e

  printf '%s\n' "$exit_code"
}

main() {
  parse_args "$@"
  set_payloads
  start_mock_servers
  run_xdiff
}

main "$@"
