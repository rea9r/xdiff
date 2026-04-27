package runner

import (
	"strings"
	"testing"
)

func TestResolveJSONTextStyle_PatchWithSemanticFilters_ReturnsError(t *testing.T) {
	_, err := resolveJSONTextStyle(DiffOptions{
		TextStyle:   TextStylePatch,
		IgnoreOrder: true,
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "ignore-order") {
		t.Fatalf("expected error message to mention ignore-order, got %q", err.Error())
	}
}

func TestValidateDiffOptions_InvalidEnums_ReturnError(t *testing.T) {
	tests := []DiffOptions{
		{Format: "yaml", TextStyle: TextStyleAuto},
		{Format: "text", TextStyle: "fancy"},
	}

	for _, tt := range tests {
		err := validateDiffOptions(tt)
		if err == nil {
			t.Fatalf("expected error for %+v", tt)
		}
	}
}
