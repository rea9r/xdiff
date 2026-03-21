package cli

import (
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/spf13/cobra"
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

	firstExample := "xdiff old.json new.json"
	if !strings.Contains(cmd.Example, firstExample) {
		t.Fatalf("missing shortest local example: %q", firstExample)
	}
	if strings.Contains(cmd.Example, "testdata/") {
		t.Fatalf("root help examples should not depend on repo-local fixture paths:\n%s", cmd.Example)
	}
}

func TestRootCommandDoesNotRegisterExampleSubcommand(t *testing.T) {
	cmd := newRootCommand(new(int), io.Discard)

	for _, child := range cmd.Commands() {
		if child.Name() == "example" {
			t.Fatal("did not expect example subcommand to be registered")
		}
	}
}

func TestRootCommandHelpDoesNotExposeExampleFlagOrCommand(t *testing.T) {
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
	exampleFlag := "--" + "example"
	if strings.Contains(help, exampleFlag) {
		t.Fatalf("help should not contain example flag:\n%s", help)
	}
	if strings.Contains(help, " example     ") {
		t.Fatalf("help should not contain example command:\n%s", help)
	}
}

func TestSubcommandsHaveExamples(t *testing.T) {
	common := newCommonFlags(io.Discard)

	tests := []struct {
		name string
		cmd  *cobra.Command
	}{
		{name: "text", cmd: newTextCommand(common, new(int))},
		{name: "url", cmd: newURLCommand(common, new(int))},
		{name: "spec", cmd: newSpecCommand(common, new(int))},
	}

	for _, tt := range tests {
		if strings.TrimSpace(tt.cmd.Example) == "" {
			t.Fatalf("%s command should have examples", tt.name)
		}
	}
}
