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

	code, out, err := RunJSONValues(oldVal, newVal, DiffOptions{Format: "text"})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if !strings.Contains(out, "--- old") || !strings.Contains(out, "+++ new") {
		t.Fatalf("unexpected output: %s", out)
	}
}

func TestRun_NoDiff_JSONFormat(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)
	newVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)

	code, out, err := RunJSONValues(oldVal, newVal, DiffOptions{Format: "json"})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if !strings.Contains(out, `"summary"`) || !strings.Contains(out, `"type_changed": 0`) {
		t.Fatalf("unexpected output: %s", out)
	}
}

func TestRun_IgnorePath_TextMode_NoDifferencesAfterFilter(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)
	newVal := decodeJSON(t, `{"user":{"name":"Hanako"}}`)

	code, out, err := RunJSONValues(oldVal, newVal, DiffOptions{
		Format:      "text",
		IgnorePaths: []string{"user.name"},
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if out != "No differences.\n" {
		t.Fatalf("unexpected output: %q", out)
	}
}

func TestRun_IgnorePath_TextMode_FiltersOutput(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"email":"a@example.com","age":"20"}}`)
	newVal := decodeJSON(t, `{"user":{"age":20}}`)

	code, out, err := RunJSONValues(oldVal, newVal, DiffOptions{
		Format:      "text",
		IgnorePaths: []string{"user.email"},
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if strings.Contains(out, "user.email") {
		t.Fatalf("ignored path should not appear in output: %s", out)
	}
	if !strings.Contains(out, `! user.age: string -> number`) {
		t.Fatalf("expected filtered semantic output, got: %s", out)
	}
}

func TestRun_InvalidFormat(t *testing.T) {
	code, out, err := RunJSONValues(map[string]any{}, map[string]any{}, DiffOptions{Format: "yaml"})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
}

func TestRun_IgnoreOrder_ReorderOnly_NoDifferences(t *testing.T) {
	oldVal := decodeJSON(t, `{"items":[1,2,3]}`)
	newVal := decodeJSON(t, `{"items":[3,2,1]}`)

	code, out, err := RunJSONValues(oldVal, newVal, DiffOptions{
		Format:      "text",
		IgnoreOrder: true,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if out != "No differences.\n" {
		t.Fatalf("unexpected output: %q", out)
	}
}

func TestRun_IgnoreOrder_UsesSemanticTextOutput(t *testing.T) {
	oldVal := decodeJSON(t, `{"items":[{"k":1},{"k":2}]}`)
	newVal := decodeJSON(t, `{"items":[{"k":2},{"k":3}]}`)

	code, out, err := RunJSONValues(oldVal, newVal, DiffOptions{
		Format:      "text",
		IgnoreOrder: true,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if strings.Contains(out, "--- old") || strings.Contains(out, "+++ new") {
		t.Fatalf("expected semantic output when ignore-order is enabled, got: %q", out)
	}
	if !strings.Contains(out, "~ items[") {
		t.Fatalf("expected semantic array diff, got: %q", out)
	}
}

func TestRun_TextStyleSemantic_ForJSONUsesSemanticOutput(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)
	newVal := decodeJSON(t, `{"user":{"name":"Hanako"}}`)

	code, out, err := RunJSONValues(oldVal, newVal, DiffOptions{
		Format:    "text",
		TextStyle: TextStyleSemantic,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if strings.Contains(out, "--- old") || strings.Contains(out, "+++ new") {
		t.Fatalf("expected semantic output, got: %q", out)
	}
	if !strings.Contains(out, "~ user.name:") {
		t.Fatalf("expected semantic field diff, got: %q", out)
	}
}

func TestRun_TextStylePatchWithIgnoreOrder_ReturnsError(t *testing.T) {
	oldVal := decodeJSON(t, `{"items":[1,2,3]}`)
	newVal := decodeJSON(t, `{"items":[3,2,1]}`)

	code, out, err := RunJSONValues(oldVal, newVal, DiffOptions{
		Format:      "text",
		TextStyle:   TextStylePatch,
		IgnoreOrder: true,
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
	if !strings.Contains(err.Error(), `text style "patch" cannot be used with ignore-path or ignore-order`) {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRun_InvalidTextStyle_ReturnsError(t *testing.T) {
	oldVal := decodeJSON(t, `{"user":{"name":"Taro"}}`)
	newVal := decodeJSON(t, `{"user":{"name":"Hanako"}}`)

	code, out, err := RunJSONValues(oldVal, newVal, DiffOptions{
		Format:    "text",
		TextStyle: "fancy",
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
	if !strings.Contains(err.Error(), `invalid text style "fancy"`) {
		t.Fatalf("unexpected error message: %v", err)
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
