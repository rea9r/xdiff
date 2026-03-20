package diff

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestApplyOptions(t *testing.T) {
	diffs := []Diff{
		{Type: Added, Path: "user.phone"},
		{Type: Changed, Path: "user.name"},
		{Type: Removed, Path: "user.email"},
		{Type: TypeChanged, Path: "user.age"},
	}

	opts := Options{
		IgnorePaths:  []string{"user.phone"},
		OnlyBreaking: true,
	}

	got := ApplyOptions(diffs, opts)
	want := []Diff{
		{Type: Removed, Path: "user.email"},
		{Type: TypeChanged, Path: "user.age"},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("ApplyOptions mismatch (-want +got):\n%s", diff)
	}
}
