package cli

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func runCLIForTest(args []string) (int, error) {
	return runCLI(args, io.Discard)
}

func TestRunCLI_MissingArgs(t *testing.T) {
	code, err := runCLIForTest([]string{})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
}

func TestRunCLI_UnknownCommand(t *testing.T) {
	code, err := runCLIForTest([]string{"example"})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
}

func TestRunCLI_InvalidFormat(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--output-format", "yaml", oldPath, newPath})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), "invalid output format") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_InvalidFailOn(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--fail-on", "changed", oldPath, newPath})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), "invalid fail-on mode") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_URL_MissingArgs(t *testing.T) {
	code, err := runCLIForTest([]string{"url"})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
}

func TestRunCLI_URL_InvalidHeader(t *testing.T) {
	code, err := runCLIForTest([]string{
		"url",
		"--header", "InvalidHeader",
		"https://example.com/old",
		"https://example.com/new",
	})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), "invalid header") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_URL_SuccessDiffFound(t *testing.T) {
	oldServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"user":{"name":"Taro"}}`))
	}))
	defer oldServer.Close()

	newServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"user":{"name":"Hanako"}}`))
	}))
	defer newServer.Close()

	code, err := runCLIForTest([]string{
		"url",
		oldServer.URL,
		newServer.URL,
	})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_Text_SuccessDiffFound(t *testing.T) {
	oldPath := writeCLIFile(t, "hello\nworld\n", "old.txt")
	newPath := writeCLIFile(t, "hello\ngopher\n", "new.txt")

	code, err := runCLIForTest([]string{"text", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_Text_JSONFormat(t *testing.T) {
	oldPath := writeCLIFile(t, "a\n", "old.txt")
	newPath := writeCLIFile(t, "b\n", "new.txt")

	code, err := runCLIForTest([]string{"text", "--output-format", "json", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_Spec_NonBreaking(t *testing.T) {
	oldPath := fixturePath("testdata/spec/non_breaking_old.yaml")
	newPath := fixturePath("testdata/spec/non_breaking_new.yaml")

	code, err := runCLIForTest([]string{"spec", "--fail-on", "breaking", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
}

func TestRunCLI_Spec_Breaking(t *testing.T) {
	oldPath := fixturePath("testdata/spec/breaking_old.yaml")
	newPath := fixturePath("testdata/spec/breaking_new.yaml")

	code, err := runCLIForTest([]string{"spec", "--fail-on", "breaking", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_Spec_Breaking_RequestBodyRequired(t *testing.T) {
	oldPath := fixturePath("testdata/spec/required_old.yaml")
	newPath := fixturePath("testdata/spec/required_new.yaml")

	code, err := runCLIForTest([]string{"spec", "--fail-on", "breaking", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_Spec_Breaking_ResponseTypeChanged(t *testing.T) {
	oldPath := fixturePath("testdata/spec/response_type_old.yaml")
	newPath := fixturePath("testdata/spec/response_type_new.yaml")

	code, err := runCLIForTest([]string{"spec", "--fail-on", "breaking", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_FailOnNone_ReturnsZeroEvenWhenDiffExists(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--fail-on", "none", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
}

func TestRunCLI_FailOnBreaking_ChangedOnlyReturnsZero(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--fail-on", "breaking", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
}

func TestRunCLI_FailOnBreaking_BreakingDiffReturnsOne(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"age":"20"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"age":20}}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--fail-on", "breaking", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_IgnoreOrder_ReorderedArrayReturnsZero(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"items":[1,2,3]}`, "old.json")
	newPath := writeCLIJSON(t, `{"items":[3,2,1]}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--ignore-order", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
}

func TestRunCLI_Spec_TextStylePatchIsUnsupported(t *testing.T) {
	oldPath := fixturePath("testdata/spec/non_breaking_old.yaml")
	newPath := fixturePath("testdata/spec/non_breaking_new.yaml")

	code, err := runCLIForTest([]string{"spec", "--text-style", "patch", oldPath, newPath})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), `text style "patch" is not supported for delta-only comparisons`) {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_PatchStyleWithIgnoreOrderReturnsError(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"items":[1,2,3]}`, "old.json")
	newPath := writeCLIJSON(t, `{"items":[3,2,1]}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--text-style", "patch", "--ignore-order", oldPath, newPath})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), `text style "patch" cannot be used with --ignore-path, --only-breaking, or --ignore-order`) {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_InvalidTextStyle(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--text-style", "fancy", oldPath, newPath})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), `invalid text style "fancy"`) {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestExecute_PrintsHintsForPatchAndIgnoreOrderConflict(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"items":[1,2,3]}`, "old.json")
	newPath := writeCLIJSON(t, `{"items":[3,2,1]}`, "new.json")

	var stderr bytes.Buffer
	code := Execute(
		[]string{"json", "--text-style", "patch", "--ignore-order", oldPath, newPath},
		io.Discard,
		&stderr,
	)
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}

	msg := stderr.String()
	if !strings.Contains(msg, `text style "patch" cannot be used with --ignore-path, --only-breaking, or --ignore-order`) {
		t.Fatalf("unexpected stderr: %q", msg)
	}
	if !strings.Contains(msg, "Try one of these:") {
		t.Fatalf("expected hint header, got: %q", msg)
	}
}

func TestRunCLI_RootTwoArgsReturnsHintAwareError(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, err := runCLIForTest([]string{oldPath, newPath})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), "local comparison mode must be explicit") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_JSONCommand_SuccessDiffFound(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, err := runCLIForTest([]string{"json", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_RunScenario_Success(t *testing.T) {
	dir := t.TempDir()
	oldPath := writeCLIFileInDir(t, dir, "same\n", "old.txt")
	newPath := writeCLIFileInDir(t, dir, "same\n", "new.txt")
	scenarioPath := writeCLIScenario(t, dir, "xdiff.yaml", `
version: 1
checks:
  - name: text-ok
    kind: text
    old: old.txt
    new: new.txt
`)

	code, err := runCLIForTest([]string{"run", scenarioPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
	if oldPath == "" || newPath == "" {
		t.Fatal("expected fixture paths to be created")
	}
}

func TestRunCLI_RunScenario_JSONReport(t *testing.T) {
	dir := t.TempDir()
	_ = writeCLIFileInDir(t, dir, "old\n", "old.txt")
	_ = writeCLIFileInDir(t, dir, "new\n", "new.txt")
	scenarioPath := writeCLIScenario(t, dir, "xdiff.yaml", `
version: 1
checks:
  - name: text-diff
    kind: text
    old: old.txt
    new: new.txt
`)

	code, err := runCLIForTest([]string{"run", "--report-format", "json", scenarioPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_RunScenario_ListDoesNotExecuteChecks(t *testing.T) {
	dir := t.TempDir()
	scenarioPath := writeCLIScenario(t, dir, "xdiff.yaml", `
version: 1
checks:
  - name: missing-check
    kind: text
    old: missing-old.txt
    new: missing-new.txt
`)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := Execute([]string{"run", "--list", scenarioPath}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0 stderr=%q", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "- missing-check (text)") {
		t.Fatalf("unexpected list output: %q", stdout.String())
	}
}

func TestRunCLI_RunScenario_ListJSON(t *testing.T) {
	dir := t.TempDir()
	scenarioPath := writeCLIScenario(t, dir, "xdiff.yaml", `
version: 1
checks:
  - name: json-a
    kind: json
    old: old.json
    new: new.json
`)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := Execute([]string{"run", "--list", "--report-format", "json", scenarioPath}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0 stderr=%q", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), `"checks"`) || !strings.Contains(stdout.String(), `"name": "json-a"`) {
		t.Fatalf("unexpected json list output: %q", stdout.String())
	}
}

func TestRunCLI_RunScenario_OnlyRunsSelectedChecks(t *testing.T) {
	dir := t.TempDir()
	_ = writeCLIFileInDir(t, dir, "same\n", "ok-old.txt")
	_ = writeCLIFileInDir(t, dir, "same\n", "ok-new.txt")
	scenarioPath := writeCLIScenario(t, dir, "xdiff.yaml", `
version: 1
checks:
  - name: missing-check
    kind: text
    old: missing-old.txt
    new: missing-new.txt
  - name: ok-check
    kind: text
    old: ok-old.txt
    new: ok-new.txt
`)

	code, err := runCLIForTest([]string{"run", "--only", "ok-check", scenarioPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
}

func TestRunCLI_RunScenario_ListWithOnlyFiltersOutput(t *testing.T) {
	dir := t.TempDir()
	scenarioPath := writeCLIScenario(t, dir, "xdiff.yaml", `
version: 1
checks:
  - name: first
    kind: text
    old: a.txt
    new: b.txt
  - name: second
    kind: text
    old: c.txt
    new: d.txt
`)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := Execute([]string{"run", "--list", "--only", "second", scenarioPath}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0 stderr=%q", code, stderr.String())
	}
	if strings.Contains(stdout.String(), "first") || !strings.Contains(stdout.String(), "second") {
		t.Fatalf("unexpected filtered list output: %q", stdout.String())
	}
}

func TestRunCLI_RunScenario_UnknownOnlyNameReturnsError(t *testing.T) {
	dir := t.TempDir()
	scenarioPath := writeCLIScenario(t, dir, "xdiff.yaml", `
version: 1
checks:
  - name: only-this
    kind: text
    old: a.txt
    new: b.txt
`)

	code, err := runCLIForTest([]string{"run", "--only", "missing", scenarioPath})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), "unknown check name") || !strings.Contains(err.Error(), "xdiff run --list <scenario-file>") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func writeCLIJSON(t *testing.T, content string, fileName string) string {
	return writeCLIFile(t, content, fileName)
}

func writeCLIFile(t *testing.T, content string, fileName string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), fileName)
	normalized := strings.TrimSpace(content) + "\n"
	if err := os.WriteFile(path, []byte(normalized), 0o644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return path
}

func fixturePath(path string) string {
	return filepath.Clean(path)
}

func writeCLIFileInDir(t *testing.T, dir string, content string, fileName string) string {
	t.Helper()

	path := filepath.Join(dir, fileName)
	normalized := strings.TrimSpace(content) + "\n"
	if err := os.WriteFile(path, []byte(normalized), 0o644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return path
}

func writeCLIScenario(t *testing.T, dir string, fileName string, content string) string {
	t.Helper()

	path := filepath.Join(dir, fileName)
	normalized := strings.TrimSpace(content) + "\n"
	if err := os.WriteFile(path, []byte(normalized), 0o644); err != nil {
		t.Fatalf("failed to write scenario file: %v", err)
	}
	return path
}
