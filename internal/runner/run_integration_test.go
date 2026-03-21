package runner

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRun_WithDiff_DefaultText(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro","age":"20"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako","age":20}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		Format:  "text",
		OldPath: oldPath,
		NewPath: newPath,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if !strings.Contains(out, "--- old") || !strings.Contains(out, "+++ new") {
		t.Fatalf("unexpected output: %s", out)
	}
}

func TestRun_NoDiff_JSONFormat(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		Format:  "json",
		OldPath: oldPath,
		NewPath: newPath,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if !strings.Contains(out, `"summary"`) || !strings.Contains(out, `"type_changed": 0`) {
		t.Fatalf("unexpected output: %s", out)
	}
}

func TestRun_OnlyBreakingAndIgnorePath(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"email":"a@example.com","age":"20"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"age":20}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		Format:       "text",
		IgnorePaths:  []string{"user.email"},
		OnlyBreaking: true,
		OldPath:      oldPath,
		NewPath:      newPath,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if strings.Contains(out, "user.email") {
		t.Fatalf("ignored path should not appear in output: %s", out)
	}
	if !strings.Contains(out, `! user.age: string -> number`) {
		t.Fatalf("expected filtered semantic output, got: %s", out)
	}
	if strings.Contains(out, "--- old") || strings.Contains(out, "+++ new") {
		t.Fatalf("expected semantic output for filtered mode, got: %s", out)
	}
}

func TestRun_IgnorePath_TextMode_NoDifferencesAfterFilter(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		Format:      "text",
		IgnorePaths: []string{"user.name"},
		OldPath:     oldPath,
		NewPath:     newPath,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if out != "No differences.\n" {
		t.Fatalf("unexpected output: %q", out)
	}
}

func TestRun_OnlyBreaking_TextMode_HidesNonBreakingDiffs(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		Format:       "text",
		OnlyBreaking: true,
		OldPath:      oldPath,
		NewPath:      newPath,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if out != "No differences.\n" {
		t.Fatalf("unexpected output: %q", out)
	}
}

func TestRun_InvalidPath(t *testing.T) {
	code, out, err := RunJSONFiles(Options{
		Format:  "text",
		OldPath: "not-found-old.json",
		NewPath: "not-found-new.json",
	})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
}

func TestRun_InvalidFormat(t *testing.T) {
	code, out, err := RunJSONFiles(Options{
		Format:  "yaml",
		OldPath: "old.json",
		NewPath: "new.json",
	})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
}

func TestRun_MissingPaths(t *testing.T) {
	code, out, err := RunJSONFiles(Options{
		Format: "text",
	})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
}

func TestRun_FailOnNone_WithDiffs(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, _, err := RunJSONFiles(Options{
		Format:  "text",
		FailOn:  FailOnNone,
		OldPath: oldPath,
		NewPath: newPath,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
}

func TestRun_FailOnBreaking_WithOnlyChanged(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		Format:  "text",
		FailOn:  FailOnBreaking,
		OldPath: oldPath,
		NewPath: newPath,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if !strings.Contains(out, "--- old") || !strings.Contains(out, "+++ new") {
		t.Fatalf("expected unified diff output, got: %q", out)
	}
}

func TestRun_FailOnBreaking_WithBreakingDiff(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"age":"20"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"age":20}}`, "new.json")

	code, _, err := RunJSONFiles(Options{
		Format:  "text",
		FailOn:  FailOnBreaking,
		OldPath: oldPath,
		NewPath: newPath,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
}

func writeTempJSON(t *testing.T, content string, fileName string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), fileName)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return path
}
