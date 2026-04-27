package runner

import "github.com/rea9r/xdiff/internal/delta"

type RunResult struct {
	ExitCode  int
	Output    string
	Err       error
	DiffFound bool
	Diffs     []delta.Diff
}

func (r RunResult) Triple() (int, string, error) {
	return r.ExitCode, r.Output, r.Err
}

func finalizeRun(diffs []delta.Diff, out string, err error) RunResult {
	if err != nil {
		return RunResult{
			ExitCode:  exitError,
			Output:    out,
			Err:       err,
			DiffFound: len(diffs) > 0,
			Diffs:     diffs,
		}
	}

	code := exitOK
	if len(diffs) > 0 {
		code = exitDiffFound
	}

	return RunResult{
		ExitCode:  code,
		Output:    out,
		Err:       nil,
		DiffFound: len(diffs) > 0,
		Diffs:     diffs,
	}
}
