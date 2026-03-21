package runner

import (
	"strings"
	"testing"

	"github.com/rea9r/xdiff/internal/delta"
	"github.com/rea9r/xdiff/internal/openapi"
)

func TestRunWithDiffs_FailOnBreaking(t *testing.T) {
	diffs := []delta.Diff{
		{Type: delta.Added, Path: "paths./users.post"},
	}

	code, out, err := RunDeltaDiffs(diffs, CompareOptions{
		Format: "text",
		FailOn: FailOnBreaking,
	})
	if err != nil {
		t.Fatalf("RunDeltaDiffs returned error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if out == "" {
		t.Fatalf("expected non-empty output")
	}
}

func TestRunWithDiffs_SpecTextOutput_UsesHumanizedPath(t *testing.T) {
	diffs := []delta.Diff{
		{
			Type: delta.Removed,
			Path: "paths./users.post.requestBody.required",
		},
	}

	code, out, err := RunDeltaDiffs(diffs, CompareOptions{
		Format:        "text",
		FailOn:        FailOnAny,
		PathFormatter: openapi.HumanizePath,
	})
	if err != nil {
		t.Fatalf("RunDeltaDiffs returned error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if !strings.Contains(out, "POST /users request body required") {
		t.Fatalf("expected humanized path in text output, got: %q", out)
	}
}

func TestRunWithDiffs_SpecJSONOutput_UsesCanonicalPath(t *testing.T) {
	diffs := []delta.Diff{
		{
			Type: delta.Removed,
			Path: "paths./users.post.requestBody.required",
		},
	}

	code, out, err := RunDeltaDiffs(diffs, CompareOptions{
		Format:        "json",
		FailOn:        FailOnAny,
		PathFormatter: openapi.HumanizePath,
	})
	if err != nil {
		t.Fatalf("RunDeltaDiffs returned error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if !strings.Contains(out, `"path": "paths./users.post.requestBody.required"`) {
		t.Fatalf("expected canonical path in json output, got: %q", out)
	}
	if strings.Contains(out, "POST /users request body required") {
		t.Fatalf("json output should not use humanized path, got: %q", out)
	}
}

func TestRunWithDiffs_SpecIgnorePath_UsesCanonicalPath(t *testing.T) {
	diffs := []delta.Diff{
		{
			Type: delta.Removed,
			Path: "paths./users.post.requestBody.required",
		},
	}

	code, out, err := RunDeltaDiffs(diffs, CompareOptions{
		Format:        "text",
		FailOn:        FailOnAny,
		IgnorePaths:   []string{"paths./users.post.requestBody.required"},
		PathFormatter: openapi.HumanizePath,
	})
	if err != nil {
		t.Fatalf("RunDeltaDiffs returned error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if out != "No differences.\n" {
		t.Fatalf("expected no differences after canonical ignore-path, got: %q", out)
	}
}

func TestRunWithDiffs_SpecIgnorePath_HumanizedPathDoesNotMatch(t *testing.T) {
	diffs := []delta.Diff{
		{
			Type: delta.Removed,
			Path: "paths./users.post.requestBody.required",
		},
	}

	code, out, err := RunDeltaDiffs(diffs, CompareOptions{
		Format:        "text",
		FailOn:        FailOnAny,
		IgnorePaths:   []string{"POST /users request body required"},
		PathFormatter: openapi.HumanizePath,
	})
	if err != nil {
		t.Fatalf("RunDeltaDiffs returned error: %v", err)
	}
	if code != exitDiffFound {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitDiffFound)
	}
	if !strings.Contains(out, "POST /users request body required") {
		t.Fatalf("expected diff to remain when ignore-path is humanized label, got: %q", out)
	}
}
