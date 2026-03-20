package app

import (
	"strings"
	"testing"

	"github.com/rea9r/xdiff/internal/diff"
	"github.com/rea9r/xdiff/internal/output"
)

func TestDecorateTextResult_Pass(t *testing.T) {
	out := decorateTextResult(output.TextFormat, FailOnAny, false, nil, "No differences.\n")
	if !strings.Contains(out, "Result: PASS") {
		t.Fatalf("expected PASS header, got: %s", out)
	}
	if !strings.Contains(out, "Policy: --fail-on any") {
		t.Fatalf("expected policy line, got: %s", out)
	}
}

func TestDecorateTextResult_FailBreaking(t *testing.T) {
	diffs := []diff.Diff{
		{Type: diff.TypeChanged, Path: "user.age", OldValue: "20", NewValue: 20},
	}

	out := decorateTextResult(output.TextFormat, FailOnBreaking, true, diffs, "! user.age: string -> number\n")
	if !strings.Contains(out, "Result: FAIL (breaking changes detected)") {
		t.Fatalf("expected FAIL reason, got: %s", out)
	}
	if !strings.Contains(out, "breaking=1") {
		t.Fatalf("expected breaking count, got: %s", out)
	}
}
