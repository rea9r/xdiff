package desktopapi

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeFile(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir failed: %v", err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatalf("write failed: %v", err)
	}
}

func TestCompareJSONFiles(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "old.json")
	newPath := filepath.Join(tmp, "new.json")

	writeFile(t, oldPath, `{"user":{"name":"Taro"}}`)
	writeFile(t, newPath, `{"user":{"name":"Hanako"}}`)

	svc := NewService()
	res, err := svc.CompareJSONFiles(CompareJSONRequest{
		OldPath: oldPath,
		NewPath: newPath,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "auto",
		},
	})
	if err != nil {
		t.Fatalf("CompareJSONFiles returned error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.ExitCode != 1 {
		t.Fatalf("expected exitCode 1, got %d", res.ExitCode)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if strings.TrimSpace(res.Output) == "" {
		t.Fatal("expected output")
	}
}

func TestCompareSpecFiles_MissingFile(t *testing.T) {
	svc := NewService()
	res, err := svc.CompareSpecFiles(CompareSpecRequest{
		OldPath: "missing-old.yaml",
		NewPath: "missing-new.yaml",
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "auto",
		},
	})
	if err != nil {
		t.Fatalf("CompareSpecFiles returned unexpected error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.ExitCode != 2 {
		t.Fatalf("expected exitCode 2, got %d", res.ExitCode)
	}
	if res.Error == "" {
		t.Fatal("expected error message")
	}
}

func TestCompareText(t *testing.T) {
	svc := NewService()
	res, err := svc.CompareText(CompareTextRequest{
		OldText: "hello\nworld\n",
		NewText: "hello\nxdiff\n",
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "auto",
		},
	})
	if err != nil {
		t.Fatalf("CompareText returned error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.ExitCode != 1 {
		t.Fatalf("expected exitCode 1, got %d", res.ExitCode)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if strings.TrimSpace(res.Output) == "" {
		t.Fatal("expected output")
	}
}

func TestListScenarioChecks(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "snapshots", "old.json")
	newPath := filepath.Join(tmp, "snapshots", "new.json")
	scenarioPath := filepath.Join(tmp, "xdiff.yaml")

	writeFile(t, oldPath, `{"user":{"name":"Taro"}}`)
	writeFile(t, newPath, `{"user":{"name":"Hanako"}}`)
	writeFile(t, scenarioPath, `
version: 1
checks:
  - name: local-user-json
    kind: json
    old: snapshots/old.json
    new: snapshots/new.json
`)

	svc := NewService()
	res, err := svc.ListScenarioChecks(ListScenarioChecksRequest{
		ScenarioPath: scenarioPath,
		ReportFormat: "text",
	})
	if err != nil {
		t.Fatalf("ListScenarioChecks returned error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.ExitCode != 0 {
		t.Fatalf("expected exitCode 0, got %d", res.ExitCode)
	}
	if len(res.Checks) != 1 {
		t.Fatalf("expected 1 check, got %d", len(res.Checks))
	}
	if res.Checks[0].Name != "local-user-json" {
		t.Fatalf("unexpected check name: %s", res.Checks[0].Name)
	}
}

func TestRunScenario(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "snapshots", "old.json")
	newPath := filepath.Join(tmp, "snapshots", "new.json")
	scenarioPath := filepath.Join(tmp, "xdiff.yaml")

	writeFile(t, oldPath, `{"user":{"name":"Taro"}}`)
	writeFile(t, newPath, `{"user":{"name":"Hanako"}}`)
	writeFile(t, scenarioPath, `
version: 1
checks:
  - name: local-user-json
    kind: json
    old: snapshots/old.json
    new: snapshots/new.json
`)

	svc := NewService()
	res, err := svc.RunScenario(RunScenarioRequest{
		ScenarioPath: scenarioPath,
		ReportFormat: "text",
	})
	if err != nil {
		t.Fatalf("RunScenario returned error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.Summary == nil {
		t.Fatal("expected summary")
	}
	if len(res.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(res.Results))
	}
}

func TestLoadTextFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sample.txt")
	want := "hello\nworld\n"

	if err := os.WriteFile(path, []byte(want), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	svc := NewService()
	got, err := svc.LoadTextFile(LoadTextFileRequest{Path: path})
	if err != nil {
		t.Fatalf("LoadTextFile() error = %v", err)
	}

	if got.Path != path {
		t.Fatalf("LoadTextFile() path = %q, want %q", got.Path, path)
	}

	if got.Content != want {
		t.Fatalf("LoadTextFile() content = %q, want %q", got.Content, want)
	}
}

func TestLoadTextFileRejectsNonUTF8(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "binary.bin")

	if err := os.WriteFile(path, []byte{0xff, 0xfe, 0xfd}, 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	svc := NewService()
	_, err := svc.LoadTextFile(LoadTextFileRequest{Path: path})
	if err == nil {
		t.Fatal("LoadTextFile() error = nil, want non-nil")
	}
}
