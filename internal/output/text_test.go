package output

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/rea9r/xdiff/internal/delta"
)

func TestFormatText_Golden(t *testing.T) {
	got := FormatText(sampleDiffs())
	want := readGolden(t, "sample_text.golden")

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("text output mismatch (-want +got):\n%s", diff)
	}
}

func TestRenderSemanticTextWithColor_UsesRawPath(t *testing.T) {
	diffs := []delta.Diff{
		{Type: delta.Added, Path: "paths./users.post", NewValue: "operation"},
	}

	got := RenderSemanticTextWithColor(diffs, false)

	if got != "+ paths./users.post: \"operation\"\n" {
		t.Fatalf("expected raw path output, got: %q", got)
	}
}
