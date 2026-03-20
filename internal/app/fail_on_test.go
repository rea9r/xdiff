package app

import (
	"testing"

	"github.com/rea9r/xdiff/internal/diff"
)

func TestHasFailureByMode(t *testing.T) {
	diffs := []diff.Diff{
		{Type: diff.Changed},
		{Type: diff.Removed},
	}

	tests := []struct {
		name string
		mode string
		want bool
	}{
		{name: "any with diffs", mode: FailOnAny, want: true},
		{name: "breaking with breaking diff", mode: FailOnBreaking, want: true},
		{name: "none with diffs", mode: FailOnNone, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HasFailureByMode(diffs, tt.mode)
			if got != tt.want {
				t.Fatalf("HasFailureByMode(%s) = %v, want %v", tt.mode, got, tt.want)
			}
		})
	}
}
