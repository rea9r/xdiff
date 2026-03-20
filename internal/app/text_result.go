package app

import (
	"fmt"
	"strings"

	"github.com/rea9r/xdiff/internal/diff"
	"github.com/rea9r/xdiff/internal/output"
)

func decorateTextResult(format, failOn string, hasFailure bool, diffs []diff.Diff, body string) string {
	if format != output.TextFormat {
		return body
	}

	if failOn == "" {
		failOn = FailOnAny
	}

	result := "PASS"
	reason := "policy not violated"
	if hasFailure {
		result = "FAIL"
		reason = failReasonByMode(failOn)
	}

	summary := diff.Summarize(diffs)
	breakingCount := countBreakingDiffs(diffs)

	var b strings.Builder
	fmt.Fprintf(&b, "Result: %s (%s)\n", result, reason)
	fmt.Fprintf(&b, "Policy: --fail-on %s | total=%d | breaking=%d | added=%d removed=%d changed=%d type_changed=%d\n",
		failOn,
		len(diffs),
		breakingCount,
		summary.Added,
		summary.Removed,
		summary.Changed,
		summary.TypeChanged,
	)
	if strings.TrimSpace(body) != "" {
		b.WriteString("\n")
		b.WriteString(body)
	}
	return b.String()
}

func failReasonByMode(mode string) string {
	switch mode {
	case FailOnBreaking:
		return "breaking changes detected"
	case FailOnAny:
		return "differences detected"
	case FailOnNone:
		return "policy disabled"
	default:
		return "policy violated"
	}
}

func countBreakingDiffs(diffs []diff.Diff) int {
	count := 0
	for _, d := range diffs {
		if diff.IsBreaking(d.Type) {
			count++
		}
	}
	return count
}
