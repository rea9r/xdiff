package app

import "github.com/rea9r/xdiff/internal/diff"

const (
	FailOnAny      = "any"
	FailOnBreaking = "breaking"
	FailOnNone     = "none"
)

func IsSupportedFailOn(mode string) bool {
	return mode == FailOnAny || mode == FailOnBreaking || mode == FailOnNone
}

func HasFailureByMode(diffs []diff.Diff, mode string) bool {
	switch mode {
	case FailOnNone:
		return false
	case FailOnBreaking:
		for _, d := range diffs {
			if diff.IsBreaking(d.Type) {
				return true
			}
		}
		return false
	case FailOnAny:
		fallthrough
	default:
		return len(diffs) > 0
	}
}
