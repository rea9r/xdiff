package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRunCLI_MissingArgs(t *testing.T) {
	code, err := runCLI([]string{})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
}

func TestRunCLI_Example(t *testing.T) {
	code, err := runCLI([]string{"--example"})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
}

func TestRunCLI_Example_WithPositionalArgs(t *testing.T) {
	code, err := runCLI([]string{"--example", "testdata/old.json", "testdata/new.json"})
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

	code, err := runCLI([]string{"--format", "yaml", oldPath, newPath})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), "invalid format") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_InvalidFailOn(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "new.json")

	code, err := runCLI([]string{"--fail-on", "changed", oldPath, newPath})
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
	code, err := runCLI([]string{"url"})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
}

func TestRunCLI_URL_InvalidHeader(t *testing.T) {
	code, err := runCLI([]string{
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

	code, err := runCLI([]string{
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

	code, err := runCLI([]string{"text", oldPath, newPath})
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

	code, err := runCLI([]string{"text", "--format", "json", oldPath, newPath})
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

	code, err := runCLI([]string{"spec", "--fail-on", "breaking", oldPath, newPath})
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

	code, err := runCLI([]string{"spec", "--fail-on", "breaking", oldPath, newPath})
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

	code, err := runCLI([]string{"spec", "--fail-on", "breaking", oldPath, newPath})
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

	code, err := runCLI([]string{"spec", "--fail-on", "breaking", oldPath, newPath})
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

	code, err := runCLI([]string{"--fail-on", "none", oldPath, newPath})
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

	code, err := runCLI([]string{"--fail-on", "breaking", oldPath, newPath})
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

	code, err := runCLI([]string{"--fail-on", "breaking", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
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
