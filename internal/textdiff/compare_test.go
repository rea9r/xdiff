package textdiff

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/rea9r/xdiff/internal/diff"
)

func TestCompare_NoDiff(t *testing.T) {
	got := Compare("hello\nworld\n", "hello\nworld\n")
	if len(got) != 0 {
		t.Fatalf("expected no diffs, got=%v", got)
	}
}

func TestCompare_ReplaceLine(t *testing.T) {
	got := Compare("hello\nworld\n", "hello\ngopher\n")
	want := []diff.Diff{
		{Type: diff.Removed, Path: "line[2]", OldValue: "world"},
		{Type: diff.Added, Path: "line[2]", NewValue: "gopher"},
	}

	if d := cmp.Diff(want, got); d != "" {
		t.Fatalf("diff mismatch (-want +got):\n%s", d)
	}
}

func TestCompare_InsertLine(t *testing.T) {
	got := Compare("a\nc\n", "a\nb\nc\n")
	want := []diff.Diff{
		{Type: diff.Added, Path: "line[2]", NewValue: "b"},
	}

	if d := cmp.Diff(want, got); d != "" {
		t.Fatalf("diff mismatch (-want +got):\n%s", d)
	}
}
