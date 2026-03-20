package app

import (
	"testing"

	"github.com/rea9r/xdiff/internal/diff"
)

func TestRunWithDiffs_FailOnBreaking(t *testing.T) {
	diffs := []diff.Diff{
		{Type: diff.Added, Path: "paths./users.post"},
	}

	code, out, err := RunWithDiffs(diffs, CompareOptions{
		Format: "text",
		FailOn: FailOnBreaking,
	})
	if err != nil {
		t.Fatalf("RunWithDiffs returned error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if out == "" {
		t.Fatalf("expected non-empty output")
	}
}
