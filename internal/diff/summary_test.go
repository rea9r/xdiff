package diff

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestSummarize(t *testing.T) {
	diffs := []Diff{
		{Type: Added},
		{Type: Added},
		{Type: Removed},
		{Type: Changed},
		{Type: TypeChanged},
		{Type: TypeChanged},
	}

	got := Summarize(diffs)
	want := Summary{
		Added:       2,
		Removed:     1,
		Changed:     1,
		TypeChanged: 2,
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("summary mismatch (-want +got):\n%s", diff)
	}
}
