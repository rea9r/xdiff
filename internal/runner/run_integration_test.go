package runner

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRun_WithDiff_DefaultText(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro","age":"20"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako","age":20}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{Format: "text"},
		OldPath:        oldPath,
		NewPath:        newPath,
	})
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
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{Format: "json"},
		OldPath:        oldPath,
		NewPath:        newPath,
	})
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
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{
			Format:      "text",
			IgnorePaths: []string{"user.name"},
		},
		OldPath: oldPath,
		NewPath: newPath,
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
	oldPath := writeTempJSON(t, `{"user":{"email":"a@example.com","age":"20"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"age":20}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{
			Format:      "text",
			IgnorePaths: []string{"user.email"},
		},
		OldPath: oldPath,
		NewPath: newPath,
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

func TestRun_InvalidPath(t *testing.T) {
	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{Format: "text"},
		OldPath:        "not-found-old.json",
		NewPath:        "not-found-new.json",
	})
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

func TestRun_InvalidFormat(t *testing.T) {
	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{Format: "yaml"},
		OldPath:        "old.json",
		NewPath:        "new.json",
	})
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

func TestRun_MissingPaths(t *testing.T) {
	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{Format: "text"},
	})
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
	oldPath := writeTempJSON(t, `{"items":[1,2,3]}`, "old.json")
	newPath := writeTempJSON(t, `{"items":[3,2,1]}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{
			Format:      "text",
			IgnoreOrder: true,
		},
		OldPath: oldPath,
		NewPath: newPath,
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
	oldPath := writeTempJSON(t, `{"items":[{"k":1},{"k":2}]}`, "old.json")
	newPath := writeTempJSON(t, `{"items":[{"k":2},{"k":3}]}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{
			Format:      "text",
			IgnoreOrder: true,
		},
		OldPath: oldPath,
		NewPath: newPath,
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
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{
			Format:    "text",
			TextStyle: TextStyleSemantic,
		},
		OldPath: oldPath,
		NewPath: newPath,
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
	oldPath := writeTempJSON(t, `{"items":[1,2,3]}`, "old.json")
	newPath := writeTempJSON(t, `{"items":[3,2,1]}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{
			Format:      "text",
			TextStyle:   TextStylePatch,
			IgnoreOrder: true,
		},
		OldPath: oldPath,
		NewPath: newPath,
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
	if !strings.Contains(err.Error(), `text style "patch" cannot be used with --ignore-path or --ignore-order`) {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRun_InvalidTextStyle_ReturnsError(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{
			Format:    "text",
			TextStyle: "fancy",
		},
		OldPath: oldPath,
		NewPath: newPath,
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

func TestRun_ShowPaths_RespectsIgnorePathFilter(t *testing.T) {
	oldPath := writeTempJSON(t, `{"user":{"name":"Taro","age":20}}`, "old.json")
	newPath := writeTempJSON(t, `{"user":{"name":"Hanako","age":21}}`, "new.json")

	code, out, err := RunJSONFiles(Options{
		CompareOptions: CompareOptions{
			Format:      "json",
			ShowPaths:   true,
			IgnorePaths: []string{"user.name"},
		},
		OldPath: oldPath,
		NewPath: newPath,
	})
	if err != nil {
		t.Fatalf("Run returned unexpected error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if out != "user.age\n" {
		t.Fatalf("unexpected output: %q", out)
	}
}

func writeTempJSON(t *testing.T, content string, fileName string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), fileName)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return path
}
