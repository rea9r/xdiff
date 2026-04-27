package runner

import (
	"strings"
	"testing"
)

func TestRunWithText_TextFormat(t *testing.T) {
	code, out, err := RunTextValues("hello\nworld\n", "hello\ngopher\n", DiffOptions{
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
	code, out, err := RunTextValues("a\n", "b\n", DiffOptions{
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

func TestRunWithText_TextStyleSemantic(t *testing.T) {
	code, out, err := RunTextValues("hello\nworld\n", "hello\ngopher\n", DiffOptions{
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
