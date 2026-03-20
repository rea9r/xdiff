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

func writeCLIJSON(t *testing.T, content string, fileName string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), fileName)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return path
}
