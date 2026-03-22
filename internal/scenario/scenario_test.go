package scenario

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadFile_Success(t *testing.T) {
	path := writeScenarioFile(t, `
version: 1
checks:
  - name: local-json
    kind: json
    old: old.json
    new: new.json
`)

	cfg, err := LoadFile(path)
	if err != nil {
		t.Fatalf("LoadFile returned error: %v", err)
	}
	if cfg.Version != 1 {
		t.Fatalf("unexpected version: %d", cfg.Version)
	}
	if len(cfg.Checks) != 1 {
		t.Fatalf("unexpected checks length: %d", len(cfg.Checks))
	}
}

func TestResolve_RelativePathsBasedOnScenarioDir(t *testing.T) {
	scenarioDir := filepath.Join(t.TempDir(), "configs")
	if err := os.MkdirAll(scenarioDir, 0o755); err != nil {
		t.Fatalf("failed to create scenario dir: %v", err)
	}

	scenarioPath := filepath.Join(scenarioDir, "xdiff.yaml")
	cfg := Config{
		Version: 1,
		Checks: []Check{{
			Name: "local-json",
			Kind: KindJSON,
			Old:  "fixtures/old.json",
			New:  "fixtures/new.json",
		}},
	}

	checks, err := Resolve(cfg, scenarioPath)
	if err != nil {
		t.Fatalf("Resolve returned error: %v", err)
	}
	if got, want := checks[0].Old, filepath.Join(scenarioDir, "fixtures/old.json"); got != want {
		t.Fatalf("old path mismatch: got=%q want=%q", got, want)
	}
	if got, want := checks[0].New, filepath.Join(scenarioDir, "fixtures/new.json"); got != want {
		t.Fatalf("new path mismatch: got=%q want=%q", got, want)
	}
}

func TestResolve_MergesDefaults(t *testing.T) {
	showPaths := true
	onlyBreaking := true
	noColor := true
	ignoreOrder := true

	cfg := Config{
		Version: 1,
		Defaults: Defaults{
			FailOn:       "breaking",
			IgnorePaths:  []string{"user.updated_at"},
			ShowPaths:    &showPaths,
			OnlyBreaking: &onlyBreaking,
			TextStyle:    "semantic",
			OutputFormat: "json",
			NoColor:      &noColor,
			IgnoreOrder:  &ignoreOrder,
			Headers:      []string{"Authorization: Bearer token"},
			Timeout:      "3s",
		},
		Checks: []Check{{
			Name: "local-json",
			Kind: KindJSON,
			Old:  "old.json",
			New:  "new.json",
		}},
	}

	checks, err := Resolve(cfg, filepath.Join(t.TempDir(), "xdiff.yaml"))
	if err != nil {
		t.Fatalf("Resolve returned error: %v", err)
	}

	resolved := checks[0]
	if resolved.Compare.FailOn != "breaking" {
		t.Fatalf("unexpected fail_on: %q", resolved.Compare.FailOn)
	}
	if resolved.Compare.Format != "json" {
		t.Fatalf("unexpected output format: %q", resolved.Compare.Format)
	}
	if !resolved.Compare.ShowPaths {
		t.Fatalf("expected show_paths=true")
	}
	if !resolved.Compare.OnlyBreaking {
		t.Fatalf("expected only_breaking=true")
	}
	if resolved.Compare.TextStyle != "semantic" {
		t.Fatalf("unexpected text_style: %q", resolved.Compare.TextStyle)
	}
	if resolved.Compare.UseColor {
		t.Fatalf("expected use_color=false")
	}
	if !resolved.Compare.IgnoreOrder {
		t.Fatalf("expected ignore_order=true")
	}
	if resolved.Timeout.String() != "3s" {
		t.Fatalf("unexpected timeout: %s", resolved.Timeout)
	}
	if len(resolved.Headers) != 1 || resolved.Headers[0] != "Authorization: Bearer token" {
		t.Fatalf("unexpected headers: %#v", resolved.Headers)
	}
}

func TestResolve_RejectsDuplicateCheckNames(t *testing.T) {
	cfg := Config{
		Version: 1,
		Checks: []Check{
			{Name: "dup", Kind: KindJSON, Old: "a.json", New: "b.json"},
			{Name: "dup", Kind: KindText, Old: "a.txt", New: "b.txt"},
		},
	}

	_, err := Resolve(cfg, filepath.Join(t.TempDir(), "xdiff.yaml"))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), `duplicate check name "dup"`) {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRun_AllKinds(t *testing.T) {
	tmp := t.TempDir()
	jsonOld := writeFile(t, tmp, "json_old.json", `{"user":{"name":"Taro"}}`)
	jsonNew := writeFile(t, tmp, "json_new.json", `{"user":{"name":"Hanako"}}`)

	textOld := writeFile(t, tmp, "text_old.txt", "hello\n")
	textNew := writeFile(t, tmp, "text_new.txt", "hello\n")

	specOld := writeFile(t, tmp, "spec_old.yaml", `openapi: 3.0.0
info:
  title: API
  version: "1.0"
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
`)
	specNew := writeFile(t, tmp, "spec_new.yaml", `openapi: 3.0.0
info:
  title: API
  version: "1.0"
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
    post:
      responses:
        "201":
          description: created
`)

	oldServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"user":{"name":"Taro"}}`))
	}))
	defer oldServer.Close()
	newServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"user":{"name":"Hanako"}}`))
	}))
	defer newServer.Close()

	scenarioPath := filepath.Join(tmp, "xdiff.yaml")
	cfg := Config{
		Version: 1,
		Checks: []Check{
			{Name: "json-check", Kind: KindJSON, Old: filepath.Base(jsonOld), New: filepath.Base(jsonNew)},
			{Name: "text-check", Kind: KindText, Old: filepath.Base(textOld), New: filepath.Base(textNew)},
			{Name: "url-check", Kind: KindURL, Old: oldServer.URL, New: newServer.URL},
			{Name: "spec-check", Kind: KindSpec, Old: filepath.Base(specOld), New: filepath.Base(specNew)},
		},
	}

	summary, results, err := Run(cfg, scenarioPath)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if len(results) != 4 {
		t.Fatalf("unexpected results length: %d", len(results))
	}
	if summary.Total != 4 {
		t.Fatalf("unexpected total: %d", summary.Total)
	}
	if summary.ExitCode != 1 {
		t.Fatalf("expected exit code 1, got %d", summary.ExitCode)
	}

	byName := make(map[string]Result, len(results))
	for _, r := range results {
		byName[r.Name] = r
	}
	if byName["text-check"].Status != StatusOK {
		t.Fatalf("expected text-check ok, got %s", byName["text-check"].Status)
	}
	if byName["json-check"].Status != StatusDiff {
		t.Fatalf("expected json-check diff, got %s", byName["json-check"].Status)
	}
	if byName["url-check"].Status != StatusDiff {
		t.Fatalf("expected url-check diff, got %s", byName["url-check"].Status)
	}
	if byName["spec-check"].Status != StatusDiff {
		t.Fatalf("expected spec-check diff, got %s", byName["spec-check"].Status)
	}
}

func TestRun_ExitCodeAggregation(t *testing.T) {
	tmp := t.TempDir()
	okOld := writeFile(t, tmp, "ok_old.txt", "same\n")
	okNew := writeFile(t, tmp, "ok_new.txt", "same\n")
	diffOld := writeFile(t, tmp, "diff_old.txt", "old\n")
	diffNew := writeFile(t, tmp, "diff_new.txt", "new\n")

	tests := []struct {
		name     string
		checks   []Check
		wantCode int
	}{
		{
			name: "any error returns 2",
			checks: []Check{
				{Name: "ok", Kind: KindText, Old: filepath.Base(okOld), New: filepath.Base(okNew)},
				{Name: "error", Kind: KindText, Old: "missing.txt", New: filepath.Base(okNew)},
			},
			wantCode: 2,
		},
		{
			name: "diff without error returns 1",
			checks: []Check{
				{Name: "ok", Kind: KindText, Old: filepath.Base(okOld), New: filepath.Base(okNew)},
				{Name: "diff", Kind: KindText, Old: filepath.Base(diffOld), New: filepath.Base(diffNew)},
			},
			wantCode: 1,
		},
		{
			name: "all ok returns 0",
			checks: []Check{
				{Name: "ok-1", Kind: KindText, Old: filepath.Base(okOld), New: filepath.Base(okNew)},
				{Name: "ok-2", Kind: KindText, Old: filepath.Base(okOld), New: filepath.Base(okNew)},
			},
			wantCode: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := Config{Version: 1, Checks: tt.checks}
			summary, _, err := Run(cfg, filepath.Join(tmp, "xdiff.yaml"))
			if err != nil {
				t.Fatalf("Run returned error: %v", err)
			}
			if summary.ExitCode != tt.wantCode {
				t.Fatalf("exit code mismatch: got=%d want=%d", summary.ExitCode, tt.wantCode)
			}
		})
	}
}

func TestRenderJSON_Structure(t *testing.T) {
	summary := Summary{Total: 2, OK: 1, Diff: 1, Error: 0, ExitCode: 1}
	results := []Result{
		{Name: "a", Kind: KindJSON, Status: StatusOK, ExitCode: 0},
		{Name: "b", Kind: KindSpec, Status: StatusDiff, ExitCode: 1, Output: "diff"},
	}

	raw, err := RenderJSON(summary, results)
	if err != nil {
		t.Fatalf("RenderJSON returned error: %v", err)
	}

	var got struct {
		Summary Summary  `json:"summary"`
		Results []Result `json:"results"`
	}
	if err := json.Unmarshal([]byte(raw), &got); err != nil {
		t.Fatalf("failed to unmarshal report json: %v", err)
	}

	if got.Summary.ExitCode != 1 {
		t.Fatalf("unexpected summary exit code: %d", got.Summary.ExitCode)
	}
	if len(got.Results) != 2 {
		t.Fatalf("unexpected result count: %d", len(got.Results))
	}
	if got.Results[1].Name != "b" || got.Results[1].Status != StatusDiff {
		t.Fatalf("unexpected second result: %#v", got.Results[1])
	}
}

func writeScenarioFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "xdiff.yaml")
	if err := os.WriteFile(path, []byte(strings.TrimSpace(content)+"\n"), 0o644); err != nil {
		t.Fatalf("failed to write scenario file: %v", err)
	}
	return path
}

func writeFile(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write %s: %v", name, err)
	}
	return path
}

func TestRenderText_IncludesSummaryAndDetails(t *testing.T) {
	summary := Summary{Total: 2, OK: 1, Diff: 1, ExitCode: 1}
	results := []Result{
		{Name: "ok", Kind: KindJSON, Status: StatusOK, ExitCode: 0},
		{Name: "diff", Kind: KindJSON, Status: StatusDiff, ExitCode: 1, Output: "+ user.name: \"Hanako\"\n"},
	}

	out := RenderText(summary, results, "xdiff.yaml")
	mustContain(t, out, "Scenario: xdiff.yaml")
	mustContain(t, out, "[OK] ok (json)")
	mustContain(t, out, "[DIFF] diff (json)")
	mustContain(t, out, "Summary: total=2 ok=1 diff=1 error=0")
	mustContain(t, out, "=== diff ===")
}

func mustContain(t *testing.T, got, want string) {
	t.Helper()
	if !strings.Contains(got, want) {
		t.Fatalf("expected output to contain %q, got:\n%s", want, got)
	}
}

func TestLoadFile_StrictUnknownField(t *testing.T) {
	path := writeScenarioFile(t, `
version: 1
checks:
  - name: c1
    kind: json
    old: old.json
    new: new.json
    unknown_field: 1
`)

	_, err := LoadFile(path)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "unknown_field") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolve_InvalidTimeout(t *testing.T) {
	cfg := Config{
		Version: 1,
		Checks: []Check{
			{Name: "c1", Kind: KindURL, Old: "https://old.example.com", New: "https://new.example.com", Timeout: "xyz"},
		},
	}
	_, err := Resolve(cfg, filepath.Join(t.TempDir(), "xdiff.yaml"))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "invalid timeout") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func ExampleRenderJSON() {
	summary := Summary{Total: 1, OK: 1, ExitCode: 0}
	results := []Result{{Name: "local-json", Kind: KindJSON, Status: StatusOK, ExitCode: 0}}

	raw, _ := RenderJSON(summary, results)
	fmt.Print(strings.Contains(raw, `"summary"`))
	// Output: true
}
