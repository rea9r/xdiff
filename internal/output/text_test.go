package output

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/rea9r/xdiff/internal/diff"
)

func TestFormatText_Golden(t *testing.T) {
	got := FormatText(sampleDiffs())
	want := readGolden(t, "sample_text.golden")

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("text output mismatch (-want +got):\n%s", diff)
	}
}

func TestRenderTextWithOptions_HumanizeSpecPaths(t *testing.T) {
	diffs := []diff.Diff{
		{Type: diff.Added, Path: "paths./users.post", NewValue: "operation"},
		{Type: diff.Removed, Path: "paths./users.post.requestBody.required", OldValue: "optional"},
		{Type: diff.TypeChanged, Path: "paths./users.get.responses.200.content.application/json.schema.type", OldValue: "object", NewValue: "array"},
	}

	got := RenderTextWithOptions(nil, nil, diffs, TextOptions{Color: false})

	if !strings.Contains(got, "POST /users") {
		t.Fatalf("expected humanized method/path, got: %s", got)
	}
	if !strings.Contains(got, "POST /users request body required") {
		t.Fatalf("expected humanized request body path, got: %s", got)
	}
	if !strings.Contains(got, "GET /users response 200 application/json schema type") {
		t.Fatalf("expected humanized response schema path, got: %s", got)
	}
}
