package runner

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRunWithText_TextFormat(t *testing.T) {
	code, out, err := RunTextValues("hello\nworld\n", "hello\ngopher\n", CompareOptions{
		Format: "text",
	})
	if err != nil {
		t.Fatalf("RunTextValues returned error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if !strings.Contains(out, "--- old") || !strings.Contains(out, "+++ new") {
		t.Fatalf("expected unified diff output, got: %s", out)
	}
}

func TestRunWithText_JSONFormat(t *testing.T) {
	code, out, err := RunTextValues("a\n", "b\n", CompareOptions{
		Format: "json",
	})
	if err != nil {
		t.Fatalf("RunTextValues returned error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if !strings.Contains(out, `"path": "line[1]"`) {
		t.Fatalf("expected line path in json output, got: %s", out)
	}
}

func TestRunTextWithOptions_FileInput(t *testing.T) {
	oldPath := writeTextFile(t, "old.txt", "same\n")
	newPath := writeTextFile(t, "new.txt", "same\n")

	code, out, err := RunTextFiles(Options{
		CompareOptions: CompareOptions{
			Format: "text",
		},
		OldPath: oldPath,
		NewPath: newPath,
	})
	if err != nil {
		t.Fatalf("RunTextFiles returned error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if !strings.Contains(out, "No differences.") {
		t.Fatalf("expected no-differences message, got: %s", out)
	}
}

func TestRunWithText_TextStyleSemantic(t *testing.T) {
	code, out, err := RunTextValues("hello\nworld\n", "hello\ngopher\n", CompareOptions{
		Format:    "text",
		TextStyle: TextStyleSemantic,
	})
	if err != nil {
		t.Fatalf("RunTextValues returned error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if strings.Contains(out, "--- old") || strings.Contains(out, "+++ new") {
		t.Fatalf("expected semantic output, got: %q", out)
	}
	if !strings.Contains(out, "line[2]:") {
		t.Fatalf("expected semantic line diff, got: %q", out)
	}
}

func writeTextFile(t *testing.T, name, content string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}
	return path
}
