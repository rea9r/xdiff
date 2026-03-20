package app

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRunWithText_TextFormat(t *testing.T) {
	code, out, err := RunWithText("hello\nworld\n", "hello\ngopher\n", CompareOptions{
		Format: "text",
		FailOn: FailOnAny,
	})
	if err != nil {
		t.Fatalf("RunWithText returned error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if !strings.Contains(out, "--- old") || !strings.Contains(out, "+++ new") {
		t.Fatalf("expected unified diff output, got: %s", out)
	}
}

func TestRunWithText_JSONFormat(t *testing.T) {
	code, out, err := RunWithText("a\n", "b\n", CompareOptions{
		Format: "json",
		FailOn: FailOnAny,
	})
	if err != nil {
		t.Fatalf("RunWithText returned error: %v", err)
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

	code, out, err := RunTextWithOptions(Options{
		Format:  "text",
		FailOn:  FailOnAny,
		OldPath: oldPath,
		NewPath: newPath,
	})
	if err != nil {
		t.Fatalf("RunTextWithOptions returned error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if !strings.Contains(out, "No differences.") {
		t.Fatalf("expected no-differences message, got: %s", out)
	}
}

func writeTextFile(t *testing.T, name, content string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}
	return path
}
