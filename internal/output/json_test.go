package output

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestFormatJSON_Golden(t *testing.T) {
	got, err := FormatJSON(sampleDiffs())
	if err != nil {
		t.Fatalf("FormatJSON returned error: %v", err)
	}

	want := readGolden(t, "sample_json.golden")
	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("json output mismatch (-want +got):\n%s", diff)
	}
}
