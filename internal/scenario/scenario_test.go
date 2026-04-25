package scenario

import (
	"encoding/json"
	"fmt"
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
	if err := os.MkdirAll(scenarioDir, 0o750); err != nil {
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

	scenarioPath := filepath.Join(tmp, "xdiff.yaml")
	cfg := Config{
		Version: 1,
		Checks: []Check{
			{Name: "json-check", Kind: KindJSON, Old: filepath.Base(jsonOld), New: filepath.Base(jsonNew)},
			{Name: "text-check", Kind: KindText, Old: filepath.Base(textOld), New: filepath.Base(textNew)},
		},
	}

	summary, results, err := Run(cfg, scenarioPath)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("unexpected results length: %d", len(results))
	}
	if summary.Total != 2 {
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

func TestRun_FailOnNoneStillCountsDiffInSummary(t *testing.T) {
	tmp := t.TempDir()
	oldPath := writeFile(t, tmp, "old.json", `{"user":{"name":"Taro"}}`)
	newPath := writeFile(t, tmp, "new.json", `{"user":{"name":"Hanako"}}`)

	cfg := Config{
		Version: 1,
		Checks: []Check{{
			Name:   "json-check",
			Kind:   KindJSON,
			Old:    filepath.Base(oldPath),
			New:    filepath.Base(newPath),
			FailOn: "none",
		}},
	}

	summary, results, err := Run(cfg, filepath.Join(tmp, "xdiff.yaml"))
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary.Diff != 1 || summary.OK != 0 || summary.Error != 0 {
		t.Fatalf("unexpected summary: %#v", summary)
	}
	if summary.ExitCode != 1 {
		t.Fatalf("expected scenario exit code 1, got %d", summary.ExitCode)
	}

	result := results[0]
	if result.Status != StatusDiff {
		t.Fatalf("expected diff status, got %s", result.Status)
	}
	if !result.DiffFound {
		t.Fatalf("expected diff_found=true")
	}
	if result.ExitCode != 0 {
		t.Fatalf("expected per-check exit code 0, got %d", result.ExitCode)
	}
}

func TestRun_FailOnBreakingWithNonBreakingDiffStillCountsDiffInSummary(t *testing.T) {
	tmp := t.TempDir()
	oldPath := writeFile(t, tmp, "old.json", `{"user":{"name":"Taro"}}`)
	newPath := writeFile(t, tmp, "new.json", `{"user":{"name":"Hanako"}}`)

	cfg := Config{
		Version: 1,
		Checks: []Check{{
			Name:   "json-check",
			Kind:   KindJSON,
			Old:    filepath.Base(oldPath),
			New:    filepath.Base(newPath),
			FailOn: "breaking",
		}},
	}

	summary, results, err := Run(cfg, filepath.Join(tmp, "xdiff.yaml"))
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary.Diff != 1 || summary.ExitCode != 1 {
		t.Fatalf("unexpected summary: %#v", summary)
	}

	result := results[0]
	if result.Status != StatusDiff {
		t.Fatalf("expected diff status, got %s", result.Status)
	}
	if !result.DiffFound {
		t.Fatalf("expected diff_found=true")
	}
	if result.ExitCode != 0 {
		t.Fatalf("expected per-check exit code 0, got %d", result.ExitCode)
	}
}

func TestRenderJSON_Structure(t *testing.T) {
	summary := Summary{Total: 2, OK: 1, Diff: 1, Error: 0, ExitCode: 1}
	results := []Result{
		{Name: "a", Kind: KindJSON, Status: StatusOK, ExitCode: 0, DiffFound: false},
		{Name: "b", Kind: KindText, Status: StatusDiff, ExitCode: 1, DiffFound: true, Output: "diff"},
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
	if !got.Results[1].DiffFound {
		t.Fatalf("expected second result diff_found=true")
	}
}

func TestFilterResolvedChecks_PreservesScenarioOrder(t *testing.T) {
	checks := []ResolvedCheck{{Name: "a", Kind: KindJSON}, {Name: "b", Kind: KindText}, {Name: "c", Kind: KindJSON}}

	filtered, err := FilterResolvedChecks(checks, []string{"c", "a"})
	if err != nil {
		t.Fatalf("FilterResolvedChecks returned error: %v", err)
	}
	if len(filtered) != 2 {
		t.Fatalf("unexpected filtered len: %d", len(filtered))
	}
	if filtered[0].Name != "a" || filtered[1].Name != "c" {
		t.Fatalf("unexpected order: %#v", filtered)
	}
}

func TestFilterResolvedChecks_DuplicateOnlyDoesNotDuplicateResults(t *testing.T) {
	checks := []ResolvedCheck{{Name: "a", Kind: KindJSON}, {Name: "b", Kind: KindText}}

	filtered, err := FilterResolvedChecks(checks, []string{"a", "a"})
	if err != nil {
		t.Fatalf("FilterResolvedChecks returned error: %v", err)
	}
	if len(filtered) != 1 || filtered[0].Name != "a" {
		t.Fatalf("unexpected filtered result: %#v", filtered)
	}
}

func TestFilterResolvedChecks_UnknownNameReturnsError(t *testing.T) {
	checks := []ResolvedCheck{{Name: "a", Kind: KindJSON}}

	_, err := FilterResolvedChecks(checks, []string{"missing"})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "unknown check name") {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(err.Error(), "xdiff run --list <scenario-file>") {
		t.Fatalf("expected list hint, got: %v", err)
	}
}

func TestRenderCheckListJSON_StableStructure(t *testing.T) {
	scenarioPath := "/tmp/project/scenarios/xdiff.yaml"
	checks := []ResolvedCheck{
		{Name: "a", Kind: KindJSON, Old: "/tmp/project/scenarios/data/a-old.json", New: "/tmp/project/scenarios/data/a-new.json"},
		{Name: "b", Kind: KindText, Old: "/tmp/project/scenarios/data/b-old.txt", New: "/tmp/project/scenarios/data/b-new.txt"},
	}

	raw, err := RenderCheckListJSON(checks, scenarioPath)
	if err != nil {
		t.Fatalf("RenderCheckListJSON returned error: %v", err)
	}

	var got struct {
		Checks []CheckListEntry `json:"checks"`
	}
	if err := json.Unmarshal([]byte(raw), &got); err != nil {
		t.Fatalf("failed to unmarshal check list json: %v", err)
	}
	if len(got.Checks) != 2 {
		t.Fatalf("unexpected check count: %d", len(got.Checks))
	}
	if got.Checks[0].Name != "a" || got.Checks[1].Name != "b" {
		t.Fatalf("unexpected checks: %#v", got.Checks)
	}
	if got.Checks[0].Old != "data/a-old.json" || got.Checks[0].New != "data/a-new.json" {
		t.Fatalf("expected relative paths for local checks, got: %#v", got.Checks[0])
	}
	if got.Checks[0].Summary != "data/a-old.json -> data/a-new.json" {
		t.Fatalf("unexpected summary: %q", got.Checks[0].Summary)
	}
}

func TestRenderText_IncludesSummaryAndDetails(t *testing.T) {
	summary := Summary{Total: 2, OK: 1, Diff: 1, ExitCode: 1}
	results := []Result{{Name: "ok", Kind: KindJSON, Status: StatusOK, ExitCode: 0}, {Name: "diff", Kind: KindJSON, Status: StatusDiff, ExitCode: 1, Output: "+ user.name: \"Hanako\"\n"}}

	out := RenderText(summary, results, "xdiff.yaml")
	mustContain(t, out, "Scenario: xdiff.yaml")
	mustContain(t, out, "[OK] ok (json)")
	mustContain(t, out, "[DIFF] diff (json)")
	mustContain(t, out, "Summary: total=2 ok=1 diff=1 error=0")
	mustContain(t, out, "=== diff ===")
}

func TestRenderCheckListText_IncludesTargetSummary(t *testing.T) {
	scenarioPath := "/tmp/project/scenarios/xdiff.yaml"
	checks := []ResolvedCheck{
		{
			Name: "local-user-json",
			Kind: KindJSON,
			Old:  "/tmp/project/scenarios/snapshots/old-user.json",
			New:  "/tmp/project/scenarios/snapshots/new-user.json",
		},
	}

	out := RenderCheckListText(checks, scenarioPath)
	mustContain(t, out, "- local-user-json (json) snapshots/old-user.json -> snapshots/new-user.json")
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

func writeScenarioFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "xdiff.yaml")
	if err := os.WriteFile(path, []byte(strings.TrimSpace(content)+"\n"), 0o600); err != nil {
		t.Fatalf("failed to write scenario file: %v", err)
	}
	return path
}

func writeFile(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("failed to write %s: %v", name, err)
	}
	return path
}

func mustContain(t *testing.T, got, want string) {
	t.Helper()
	if !strings.Contains(got, want) {
		t.Fatalf("expected output to contain %q, got:\n%s", want, got)
	}
}

func ExampleRenderJSON() {
	summary := Summary{Total: 1, OK: 1, ExitCode: 0}
	results := []Result{{Name: "local-json", Kind: KindJSON, Status: StatusOK, ExitCode: 0}}

	raw, _ := RenderJSON(summary, results)
	fmt.Print(strings.Contains(raw, `"summary"`))
	// Output: true
}
