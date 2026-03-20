package spec

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/rea9r/apidiff/internal/diff"
)

func TestComparePathsMethods(t *testing.T) {
	oldSpec := map[string]any{
		"paths": map[string]any{
			"/users": map[string]any{
				"get":  map[string]any{},
				"post": map[string]any{},
			},
			"/orders": map[string]any{
				"get": map[string]any{},
			},
		},
	}
	newSpec := map[string]any{
		"paths": map[string]any{
			"/users": map[string]any{
				"get":    map[string]any{},
				"delete": map[string]any{},
			},
			"/products": map[string]any{
				"post": map[string]any{},
			},
		},
	}

	got := ComparePathsMethods(oldSpec, newSpec)
	want := []diff.Diff{
		{Type: diff.Removed, Path: "paths./orders.get", OldValue: "operation", NewValue: nil},
		{Type: diff.Added, Path: "paths./products.post", OldValue: nil, NewValue: "operation"},
		{Type: diff.Added, Path: "paths./users.delete", OldValue: nil, NewValue: "operation"},
		{Type: diff.Removed, Path: "paths./users.post", OldValue: "operation", NewValue: nil},
	}

	if d := cmp.Diff(want, got); d != "" {
		t.Fatalf("ComparePathsMethods mismatch (-want +got):\n%s", d)
	}
}
