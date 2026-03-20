package main

import (
	"strings"
	"testing"
)

func TestBuildExampleOutput_Default(t *testing.T) {
	out, sampleCode, err := buildExampleOutput(commonFlagValues{
		format: "text",
		failOn: "any",
	})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if sampleCode != 1 {
		t.Fatalf("sample exit code mismatch: got=%d want=1", sampleCode)
	}
	if !strings.Contains(out, "Run:\n  xdiff testdata/old.json testdata/new.json") {
		t.Fatalf("missing run command in output: %q", out)
	}
	if !strings.Contains(out, "Expected output:") {
		t.Fatalf("missing expected output section: %q", out)
	}
	if strings.Contains(out, "Result:") || strings.Contains(out, "Policy:") {
		t.Fatalf("expected output should not include summary header: %q", out)
	}
	if !strings.Contains(out, "Sample command exit code (with current --fail-on): 1") {
		t.Fatalf("missing sample exit code line: %q", out)
	}
}
