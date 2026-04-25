package delta

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestApplyOptions(t *testing.T) {
	diffs := []Diff{
		{Type: Added, Path: "user.phone"},
		{Type: Changed, Path: "user.name"},
		{Type: Removed, Path: "user.email"},
	}

	opts := Options{
		IgnorePaths: []string{"user.phone"},
	}

	got := ApplyOptions(diffs, opts)
	want := []Diff{
		{Type: Changed, Path: "user.name"},
		{Type: Removed, Path: "user.email"},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("ApplyOptions mismatch (-want +got):\n%s", diff)
	}
}
