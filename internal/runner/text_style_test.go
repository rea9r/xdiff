package runner

import (
	"errors"
	"testing"
)

func TestResolveJSONTextStyle_PatchWithSemanticFilters_ReturnsUserHintError(t *testing.T) {
	_, err := resolveJSONTextStyle(CompareOptions{
		TextStyle:   TextStylePatch,
		IgnoreOrder: true,
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var hintErr *UserHintError
	if !errors.As(err, &hintErr) {
		t.Fatalf("expected UserHintError, got %T", err)
	}
	if len(hintErr.Hints) == 0 {
		t.Fatal("expected non-empty hints")
	}
}

func TestValidateCompareOptions_InvalidEnums_ReturnUserHintError(t *testing.T) {
	tests := []CompareOptions{
		{Format: "yaml", TextStyle: TextStyleAuto},
		{Format: "text", TextStyle: "fancy"},
	}

	for _, tt := range tests {
		err := validateCompareOptions(tt)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		var hintErr *UserHintError
		if !errors.As(err, &hintErr) {
			t.Fatalf("expected UserHintError, got %T", err)
		}
		if len(hintErr.Hints) == 0 {
			t.Fatal("expected non-empty hints")
		}
	}
}
