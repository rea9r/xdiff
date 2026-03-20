package diff

import "testing"

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

	if got != want {
		t.Fatalf("summary mismatch: got=%+v want=%+v", got, want)
	}
}
