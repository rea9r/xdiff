package runner

import "github.com/rea9r/xdiff/internal/delta"

type RunResult struct {
	Output    string
	Err       error
	DiffFound bool
	Diffs     []delta.Diff
}

func finalizeRun(diffs []delta.Diff, out string, err error) RunResult {
	return RunResult{
		Output:    out,
		Err:       err,
		DiffFound: len(diffs) > 0,
		Diffs:     diffs,
	}
}
