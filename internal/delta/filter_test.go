package delta

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestFilterIgnoredPaths(t *testing.T) {
	diffs := []Diff{
		{Type: Changed, Path: "user.name"},
		{Type: Changed, Path: "user.updated_at"},
		{Type: Added, Path: "meta.request_id"},
	}

	got := FilterIgnoredPaths(diffs, []string{"user.updated_at", "meta.request_id"})
	want := []Diff{
		{Type: Changed, Path: "user.name"},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("filtered diff mismatch (-want +got):\n%s", diff)
	}
}

func TestFilterIgnoredPaths_NoIgnores(t *testing.T) {
	diffs := []Diff{
		{Type: Changed, Path: "user.name"},
	}

	got := FilterIgnoredPaths(diffs, nil)
	if diff := cmp.Diff(diffs, got); diff != "" {
		t.Fatalf("filtered diff mismatch (-want +got):\n%s", diff)
	}
}
