package app

import (
	"testing"

	"github.com/rea9r/xdiff/internal/output"
)

func TestDecorateTextResult_Pass(t *testing.T) {
	body := "No differences.\n"
	out := decorateTextResult(output.TextFormat, FailOnAny, false, nil, body)
	if out != body {
		t.Fatalf("expected body to be returned as-is, got: %q", out)
	}
}

func TestDecorateTextResult_JSON_PassThrough(t *testing.T) {
	body := "{\"summary\":{}}\n"
	out := decorateTextResult(output.JSONFormat, FailOnAny, true, nil, body)
	if out != body {
		t.Fatalf("expected json body to be unchanged, got: %q", out)
	}
}
