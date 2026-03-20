package app

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRun_WithDiff_DefaultText(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro","age":"20"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako","age":20}}`, "new.json")

	code, out, err := Run([]string{oldPath, newPath})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if !strings.Contains(out, "CHANGED") || !strings.Contains(out, "TYPE_CHANGED") {
		t.Fatalf("unexpected output: %s", out)
	}
}

func TestRun_NoDiff_JSONFormat(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "new.json")

	code, out, err := Run([]string{"--format", "json", oldPath, newPath})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if !strings.Contains(out, `"diffs": []`) || !strings.Contains(out, `"type_changed": 0`) {
		t.Fatalf("unexpected output: %s", out)
	}
}

func TestRun_OnlyBreakingAndIgnorePath(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"email":"a@example.com","age":"20"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"age":20}}`, "new.json")

	code, out, err := Run([]string{
		"--only-breaking",
		"--ignore-path", "user.email",
		oldPath, newPath,
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
	if !strings.Contains(out, "TYPE_CHANGED") || !strings.Contains(out, "user.age") {
		t.Fatalf("expected type_changed output, got: %s", out)
	}
}

func TestRun_InvalidPath(t *testing.T) {
	code, out, err := Run([]string{"not-found-old.json", "not-found-new.json"})
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

func writeTempJSON(t *testing.T, content string, fileName string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), fileName)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return path
}
