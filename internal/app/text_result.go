package app

import (
	"github.com/rea9r/xdiff/internal/diff"
	"github.com/rea9r/xdiff/internal/output"
)

func decorateTextResult(format, failOn string, hasFailure bool, diffs []diff.Diff, body string) string {
	if format != output.TextFormat {
		return body
	}
	return body
}
