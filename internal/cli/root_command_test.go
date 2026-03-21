package cli

import (
	"io"
	"strings"
	"testing"
)

func TestRootHelpContent_IsTaskOriented(t *testing.T) {
	cmd := newRootCommand(new(int), io.Discard, io.Discard)

	if !strings.Contains(cmd.Long, "Local comparison") {
		t.Fatalf("missing Local comparison section in Long help")
	}
	if !strings.Contains(cmd.Long, "URL comparison") {
		t.Fatalf("missing URL comparison section in Long help")
	}
	if !strings.Contains(cmd.Long, "OpenAPI comparison") {
		t.Fatalf("missing OpenAPI comparison section in Long help")
	}
	if !strings.Contains(cmd.Long, "CI usage") {
		t.Fatalf("missing CI usage section in Long help")
	}

	firstExample := "xdiff testdata/old.json testdata/new.json"
	if !strings.Contains(cmd.Example, firstExample) {
		t.Fatalf("missing shortest local example: %q", firstExample)
	}
}
