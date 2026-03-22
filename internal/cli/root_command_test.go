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

	if !strings.Contains(cmd.Long, "JSON comparison") {
		t.Fatalf("missing JSON comparison section in Long help")
	}
	if !strings.Contains(cmd.Long, "Text comparison") {
		t.Fatalf("missing Text comparison section in Long help")
	}
	if !strings.Contains(cmd.Long, "URL comparison") {
		t.Fatalf("missing URL comparison section in Long help")
	}
	if !strings.Contains(cmd.Long, "OpenAPI comparison") {
		t.Fatalf("missing OpenAPI comparison section in Long help")
	}
	if !strings.Contains(cmd.Long, "Scenario mode") {
		t.Fatalf("missing Scenario mode section in Long help")
	}
	if !strings.Contains(cmd.Long, "CI usage") {
		t.Fatalf("missing CI usage section in Long help")
	}

	firstExample := "xdiff json old.json new.json"
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

func TestRootCommandRegistersJSONSubcommand(t *testing.T) {
	cmd := newRootCommand(new(int), io.Discard)
	found, _, err := cmd.Find([]string{"json"})
	if err != nil {
		t.Fatalf("unexpected find error: %v", err)
	}
	if found == nil || found.Name() != "json" {
		t.Fatal("expected json subcommand to be registered")
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
		{name: "json", cmd: newJSONCommand(common, new(int))},
		{name: "text", cmd: newTextCommand(common, new(int))},
		{name: "url", cmd: newURLCommand(common, new(int))},
		{name: "spec", cmd: newSpecCommand(common, new(int))},
		{name: "run", cmd: newRunCommand(new(int), io.Discard)},
	}

	for _, tt := range tests {
		if strings.TrimSpace(tt.cmd.Example) == "" {
			t.Fatalf("%s command should have examples", tt.name)
		}
	}
}

func TestIgnoreOrderFlagAvailability(t *testing.T) {
	common := newCommonFlags(io.Discard)

	root := newRootCommand(new(int), io.Discard)
	if root.Flags().Lookup("ignore-order") != nil {
		t.Fatal("root command should not expose --ignore-order")
	}
	if strings.Contains(root.Flags().FlagUsages(), "--ignore-order") {
		t.Fatal("root help should not include --ignore-order")
	}

	jsonCmd := newJSONCommand(common, new(int))
	if jsonCmd.Flags().Lookup("ignore-order") == nil {
		t.Fatal("json command should expose --ignore-order")
	}
	if !strings.Contains(jsonCmd.Flags().FlagUsages(), "--ignore-order") {
		t.Fatal("json help should include --ignore-order")
	}

	urlCmd := newURLCommand(common, new(int))
	if urlCmd.Flags().Lookup("ignore-order") == nil {
		t.Fatal("url command should expose --ignore-order")
	}
	if !strings.Contains(urlCmd.Flags().FlagUsages(), "--ignore-order") {
		t.Fatal("url help should include --ignore-order")
	}

	textCmd := newTextCommand(common, new(int))
	if textCmd.Flags().Lookup("ignore-order") != nil {
		t.Fatal("text command should not expose --ignore-order")
	}
	if strings.Contains(textCmd.Flags().FlagUsages(), "--ignore-order") {
		t.Fatal("text help should not include --ignore-order")
	}

	specCmd := newSpecCommand(common, new(int))
	if specCmd.Flags().Lookup("ignore-order") != nil {
		t.Fatal("spec command should not expose --ignore-order")
	}
	if strings.Contains(specCmd.Flags().FlagUsages(), "--ignore-order") {
		t.Fatal("spec help should not include --ignore-order")
	}
}

func TestTextStyleFlagAvailability(t *testing.T) {
	common := newCommonFlags(io.Discard)

	root := newRootCommand(new(int), io.Discard)
	if root.Flags().Lookup("text-style") != nil {
		t.Fatal("root command should not expose --text-style")
	}
	if strings.Contains(root.Flags().FlagUsages(), "--text-style") {
		t.Fatal("root help should not include --text-style")
	}

	jsonCmd := newJSONCommand(common, new(int))
	if jsonCmd.Flags().Lookup("text-style") == nil {
		t.Fatal("json command should expose --text-style")
	}
	if !strings.Contains(jsonCmd.Flags().FlagUsages(), "--text-style") {
		t.Fatal("json help should include --text-style")
	}

	urlCmd := newURLCommand(common, new(int))
	if urlCmd.Flags().Lookup("text-style") == nil {
		t.Fatal("url command should expose --text-style")
	}
	if !strings.Contains(urlCmd.Flags().FlagUsages(), "--text-style") {
		t.Fatal("url help should include --text-style")
	}

	textCmd := newTextCommand(common, new(int))
	if textCmd.Flags().Lookup("text-style") == nil {
		t.Fatal("text command should expose --text-style")
	}

	specCmd := newSpecCommand(common, new(int))
	if specCmd.Flags().Lookup("text-style") == nil {
		t.Fatal("spec command should expose --text-style")
	}
}

func TestShowPathsFlagAvailability(t *testing.T) {
	common := newCommonFlags(io.Discard)

	root := newRootCommand(new(int), io.Discard)
	if root.Flags().Lookup("show-paths") != nil {
		t.Fatal("root command should not expose --show-paths")
	}
	if strings.Contains(root.Flags().FlagUsages(), "--show-paths") {
		t.Fatal("root help should not include --show-paths")
	}

	jsonCmd := newJSONCommand(common, new(int))
	if jsonCmd.Flags().Lookup("show-paths") == nil {
		t.Fatal("json command should expose --show-paths")
	}
	if !strings.Contains(jsonCmd.Flags().FlagUsages(), "--show-paths") {
		t.Fatal("json help should include --show-paths")
	}

	urlCmd := newURLCommand(common, new(int))
	if urlCmd.Flags().Lookup("show-paths") == nil {
		t.Fatal("url command should expose --show-paths")
	}
	if !strings.Contains(urlCmd.Flags().FlagUsages(), "--show-paths") {
		t.Fatal("url help should include --show-paths")
	}

	textCmd := newTextCommand(common, new(int))
	if textCmd.Flags().Lookup("show-paths") == nil {
		t.Fatal("text command should expose --show-paths")
	}
	if !strings.Contains(textCmd.Flags().FlagUsages(), "--show-paths") {
		t.Fatal("text help should include --show-paths")
	}

	specCmd := newSpecCommand(common, new(int))
	if specCmd.Flags().Lookup("show-paths") == nil {
		t.Fatal("spec command should expose --show-paths")
	}
	if !strings.Contains(specCmd.Flags().FlagUsages(), "--show-paths") {
		t.Fatal("spec help should include --show-paths")
	}
}
