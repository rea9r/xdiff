package runner

import (
	"strings"
	"testing"
)

func TestRunWithText_TextFormat(t *testing.T) {
	res := RunTextValuesDetailed("hello\nworld\n", "hello\ngopher\n", DiffOptions{
		Format: "text",
	})
	if res.Err != nil {
		t.Fatalf("RunTextValuesDetailed returned error: %v", res.Err)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if !strings.Contains(res.Output, "--- old") || !strings.Contains(res.Output, "+++ new") {
		t.Fatalf("expected unified diff output, got: %s", res.Output)
	}
}

func TestRunWithText_JSONFormat(t *testing.T) {
	res := RunTextValuesDetailed("a\n", "b\n", DiffOptions{
		Format: "json",
	})
	if res.Err != nil {
		t.Fatalf("RunTextValuesDetailed returned error: %v", res.Err)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if !strings.Contains(res.Output, `"path": "line[1]"`) {
		t.Fatalf("expected line path in json output, got: %s", res.Output)
	}
}

func TestRunWithText_TextStyleSemantic(t *testing.T) {
	res := RunTextValuesDetailed("hello\nworld\n", "hello\ngopher\n", DiffOptions{
		Format:    "text",
		TextStyle: TextStyleSemantic,
	})
	if res.Err != nil {
		t.Fatalf("RunTextValuesDetailed returned error: %v", res.Err)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if strings.Contains(res.Output, "--- old") || strings.Contains(res.Output, "+++ new") {
		t.Fatalf("expected semantic output, got: %q", res.Output)
	}
	if !strings.Contains(res.Output, "line[2]:") {
		t.Fatalf("expected semantic line diff, got: %q", res.Output)
	}
}
