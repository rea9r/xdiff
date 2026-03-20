package input

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadOpenAPISpecFile_JSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "openapi.json")
	content := `{"openapi":"3.0.0","paths":{"/users":{"get":{}}}}`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write temp spec: %v", err)
	}

	got, err := LoadOpenAPISpecFile(path)
	if err != nil {
		t.Fatalf("LoadOpenAPISpecFile returned error: %v", err)
	}

	root, ok := got.(map[string]any)
	if !ok {
		t.Fatalf("result was not object: %#v", got)
	}
	if root["openapi"] != "3.0.0" {
		t.Fatalf("openapi version mismatch: got=%v want=%v", root["openapi"], "3.0.0")
	}
}

func TestLoadOpenAPISpecFile_YAML(t *testing.T) {
	path := filepath.Join(t.TempDir(), "openapi.yaml")
	content := "openapi: 3.0.0\npaths:\n  /users:\n    get: {}\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write temp spec: %v", err)
	}

	got, err := LoadOpenAPISpecFile(path)
	if err != nil {
		t.Fatalf("LoadOpenAPISpecFile returned error: %v", err)
	}

	root, ok := got.(map[string]any)
	if !ok {
		t.Fatalf("result was not object: %#v", got)
	}
	paths, ok := root["paths"].(map[string]any)
	if !ok {
		t.Fatalf("paths was not object: %#v", root["paths"])
	}
	if _, ok := paths["/users"]; !ok {
		t.Fatalf("missing /users path: %#v", paths)
	}
}
