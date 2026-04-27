package runner

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestRun_WithDiff_DefaultText(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"name":"Taro","age":"20"}}`)
	newVal := decodeJSON(t, `{"user":{"name":"Hanako","age":20}}`)

	res := RunJSONValuesDetailed(oldVal, newVal, DiffOptions{Format: "text"})
	if res.Err != nil {
		t.Fatalf("Run returned unexpected error: %v", res.Err)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if !strings.Contains(res.Output, "--- old") || !strings.Contains(res.Output, "+++ new") {
		t.Fatalf("unexpected output: %s", res.Output)
	}
}

func TestRun_NoDiff_JSONFormat(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)
	newVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)

	res := RunJSONValuesDetailed(oldVal, newVal, DiffOptions{Format: "json"})
	if res.Err != nil {
		t.Fatalf("Run returned unexpected error: %v", res.Err)
	}
	if res.DiffFound {
		t.Fatal("expected diffFound=false")
	}
	if !strings.Contains(res.Output, `"summary"`) || !strings.Contains(res.Output, `"type_changed": 0`) {
		t.Fatalf("unexpected output: %s", res.Output)
	}
}

func TestRun_IgnorePath_TextMode_NoDifferencesAfterFilter(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)
	newVal := decodeJSON(t, `{"user":{"name":"Hanako"}}`)

	res := RunJSONValuesDetailed(oldVal, newVal, DiffOptions{
		Format:      "text",
		IgnorePaths: []string{"user.name"},
	})
	if res.Err != nil {
		t.Fatalf("Run returned unexpected error: %v", res.Err)
	}
	if res.DiffFound {
		t.Fatal("expected diffFound=false")
	}
	if res.Output != "No differences.\n" {
		t.Fatalf("unexpected output: %q", res.Output)
	}
}

func TestRun_IgnorePath_TextMode_FiltersOutput(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"email":"a@example.com","age":"20"}}`)
	newVal := decodeJSON(t, `{"user":{"age":20}}`)

	res := RunJSONValuesDetailed(oldVal, newVal, DiffOptions{
		Format:      "text",
		IgnorePaths: []string{"user.email"},
	})
	if res.Err != nil {
		t.Fatalf("Run returned unexpected error: %v", res.Err)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if strings.Contains(res.Output, "user.email") {
		t.Fatalf("ignored path should not appear in output: %s", res.Output)
	}
	if !strings.Contains(res.Output, `! user.age: string -> number`) {
		t.Fatalf("expected filtered semantic output, got: %s", res.Output)
	}
}

func TestRun_InvalidFormat(t *testing.T) {
	res := RunJSONValuesDetailed(map[string]any{}, map[string]any{}, DiffOptions{Format: "yaml"})
	if res.Err == nil {
		t.Fatal("expected error, got nil")
	}
	if res.Output != "" {
		t.Fatalf("expected empty output on error, got: %q", res.Output)
	}
}

func TestRun_IgnoreOrder_ReorderOnly_NoDifferences(t *testing.T) {
	oldVal := decodeJSON(t, `{"items":[1,2,3]}`)
	newVal := decodeJSON(t, `{"items":[3,2,1]}`)

	res := RunJSONValuesDetailed(oldVal, newVal, DiffOptions{
		Format:      "text",
		IgnoreOrder: true,
	})
	if res.Err != nil {
		t.Fatalf("Run returned unexpected error: %v", res.Err)
	}
	if res.DiffFound {
		t.Fatal("expected diffFound=false")
	}
	if res.Output != "No differences.\n" {
		t.Fatalf("unexpected output: %q", res.Output)
	}
}

func TestRun_IgnoreOrder_UsesSemanticTextOutput(t *testing.T) {
	oldVal := decodeJSON(t, `{"items":[{"k":1},{"k":2}]}`)
	newVal := decodeJSON(t, `{"items":[{"k":2},{"k":3}]}`)

	res := RunJSONValuesDetailed(oldVal, newVal, DiffOptions{
		Format:      "text",
		IgnoreOrder: true,
	})
	if res.Err != nil {
		t.Fatalf("Run returned unexpected error: %v", res.Err)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if strings.Contains(res.Output, "--- old") || strings.Contains(res.Output, "+++ new") {
		t.Fatalf("expected semantic output when ignore-order is enabled, got: %q", res.Output)
	}
	if !strings.Contains(res.Output, "~ items[") {
		t.Fatalf("expected semantic array diff, got: %q", res.Output)
	}
}

func TestRun_TextStyleSemantic_ForJSONUsesSemanticOutput(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)
	newVal := decodeJSON(t, `{"user":{"name":"Hanako"}}`)

	res := RunJSONValuesDetailed(oldVal, newVal, DiffOptions{
		Format:    "text",
		TextStyle: TextStyleSemantic,
	})
	if res.Err != nil {
		t.Fatalf("Run returned unexpected error: %v", res.Err)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if strings.Contains(res.Output, "--- old") || strings.Contains(res.Output, "+++ new") {
		t.Fatalf("expected semantic output, got: %q", res.Output)
	}
	if !strings.Contains(res.Output, "~ user.name:") {
		t.Fatalf("expected semantic field diff, got: %q", res.Output)
	}
}

func TestRun_TextStylePatchWithIgnoreOrder_ReturnsError(t *testing.T) {
	oldVal := decodeJSON(t, `{"items":[1,2,3]}`)
	newVal := decodeJSON(t, `{"items":[3,2,1]}`)

	res := RunJSONValuesDetailed(oldVal, newVal, DiffOptions{
		Format:      "text",
		TextStyle:   TextStylePatch,
		IgnoreOrder: true,
	})
	if res.Err == nil {
		t.Fatal("expected error, got nil")
	}
	if res.Output != "" {
		t.Fatalf("expected empty output on error, got: %q", res.Output)
	}
	if !strings.Contains(res.Err.Error(), `text style "patch" cannot be used with ignore-path or ignore-order`) {
		t.Fatalf("unexpected error message: %v", res.Err)
	}
}

func TestRun_InvalidTextStyle_ReturnsError(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)
	newVal := decodeJSON(t, `{"user":{"name":"Hanako"}}`)

	res := RunJSONValuesDetailed(oldVal, newVal, DiffOptions{
		Format:    "text",
		TextStyle: "fancy",
	})
	if res.Err == nil {
		t.Fatal("expected error, got nil")
	}
	if res.Output != "" {
		t.Fatalf("expected empty output on error, got: %q", res.Output)
	}
	if !strings.Contains(res.Err.Error(), `invalid text style "fancy"`) {
		t.Fatalf("unexpected error message: %v", res.Err)
	}
}

func decodeJSON(t *testing.T, raw string) any {
	t.Helper()

	dec := json.NewDecoder(bytes.NewReader([]byte(raw)))
	dec.UseNumber()

	var value any
	if err := dec.Decode(&value); err != nil {
		t.Fatalf("failed to decode JSON: %v", err)
	}
	return value
}
