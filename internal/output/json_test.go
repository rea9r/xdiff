package output

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/rea9r/xdiff/internal/delta"
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

func TestFormatJSON_PreservesZeroValues(t *testing.T) {
	diffs := []delta.Diff{
		{
			Type:     delta.TypeChanged,
			Path:     "$.num",
			OldValue: 0,
			NewValue: 5,
		},
		{
			Type:     delta.TypeChanged,
			Path:     "$.flag",
			OldValue: false,
			NewValue: true,
		},
		{
			Type:     delta.TypeChanged,
			Path:     "$.text",
			OldValue: "",
			NewValue: "next",
		},
	}

	got, err := FormatJSON(diffs)
	if err != nil {
		t.Fatalf("FormatJSON returned error: %v", err)
	}

	mustContain := []string{
		`"path": "$.num"`,
		`"old_value": 0`,
		`"path": "$.flag"`,
		`"old_value": false`,
		`"path": "$.text"`,
		`"old_value": ""`,
	}

	for _, want := range mustContain {
		if !strings.Contains(got, want) {
			t.Fatalf("expected JSON output to contain %q, got:\n%s", want, got)
		}
	}
}
