package diff

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestIsBreaking(t *testing.T) {
	tests := []struct {
		name string
		typ  DiffType
		want bool
	}{
		{name: "added", typ: Added, want: false},
		{name: "removed", typ: Removed, want: true},
		{name: "changed", typ: Changed, want: false},
		{name: "type changed", typ: TypeChanged, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsBreaking(tt.typ)
			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Fatalf("IsBreaking(%s) mismatch (-want +got):\n%s", tt.typ, diff)
			}
		})
	}
}
