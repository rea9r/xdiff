package cli

import (
	"bytes"
	"io"
	"strings"
	"testing"
)

func TestRootHelpContent_IsTaskOriented(t *testing.T) {
	cmd := newRootCommand(new(int), io.Discard)

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

func TestRootCommandRegistersExampleSubcommand(t *testing.T) {
	cmd := newRootCommand(new(int), io.Discard)

	found := false
	for _, child := range cmd.Commands() {
		if child.Name() == "example" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected example subcommand to be registered")
	}
}

func TestRootCommandHelpDoesNotExposeExampleFlag(t *testing.T) {
	exitCode := 0
	var out bytes.Buffer

	cmd := newRootCommand(&exitCode, &out)
	cmd.SetOut(&out)
	cmd.SetErr(&out)
	cmd.SetArgs([]string{"--help"})

	if err := cmd.Execute(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	help := out.String()
	if strings.Contains(help, "--example") {
		t.Fatalf("help should not contain --example:\n%s", help)
	}
	if !strings.Contains(help, "example") {
		t.Fatalf("help should contain example subcommand:\n%s", help)
	}
}
