package output

import (
	"strings"
	"testing"
)

func TestColorizeUnified_HeaderColors(t *testing.T) {
	input := "--- old\n+++ new\n@@ -1 +1 @@\n-a\n+b\n"
	got := colorizeUnified(input, true)

	if !strings.Contains(got, colorRed+"--- old\n"+colorReset) {
		t.Fatalf("expected red color for old header")
	}
	if !strings.Contains(got, colorGreen+"+++ new\n"+colorReset) {
		t.Fatalf("expected green color for new header")
	}
	if !strings.Contains(got, colorCyan+"@@ -1 +1 @@\n"+colorReset) {
		t.Fatalf("expected cyan color for hunk header")
	}
}
