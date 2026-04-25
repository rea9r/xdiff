package scenario

import (
	"fmt"

	"github.com/rea9r/xdiff/internal/runner"
)

func Run(cfg Config, scenarioPath string) (Summary, []Result, error) {
	checks, err := Resolve(cfg, scenarioPath)
	if err != nil {
		return Summary{}, nil, err
	}
	summary, results := RunResolved(checks)
	return summary, results, nil
}

func RunResolved(checks []ResolvedCheck) (Summary, []Result) {
	results := make([]Result, 0, len(checks))
	summary := Summary{Total: len(checks)}

	for _, check := range checks {
		result := runCheck(check)
		results = append(results, result)
		switch result.Status {
		case StatusOK:
			summary.OK++
		case StatusDiff:
			summary.Diff++
		case StatusError:
			summary.Error++
		}
	}

	switch {
	case summary.Error > 0:
		summary.ExitCode = 2
	case summary.Diff > 0:
		summary.ExitCode = 1
	default:
		summary.ExitCode = 0
	}

	return summary, results
}

func runCheck(check ResolvedCheck) Result {
	switch check.Kind {
	case KindJSON:
		return resultFromRun(check, runner.RunJSONFilesDetailed(runner.Options{
			CompareOptions: check.Compare,
			OldPath:        check.Old,
			NewPath:        check.New,
		}))

	case KindText:
		return resultFromRun(check, runner.RunTextFilesDetailed(runner.Options{
			CompareOptions: check.Compare,
			OldPath:        check.Old,
			NewPath:        check.New,
		}))

	default:
		return resultFromRun(check, runner.RunResult{
			ExitCode: 2,
			Err:      fmt.Errorf("unsupported kind %q", check.Kind),
		})
	}
}

func resultFromRun(check ResolvedCheck, runResult runner.RunResult) Result {
	result := Result{
		Name:      check.Name,
		Kind:      check.Kind,
		ExitCode:  runResult.ExitCode,
		DiffFound: runResult.DiffFound,
		Output:    runResult.Output,
	}

	if runResult.Err != nil {
		result.Status = StatusError
		result.ErrorMessage = runResult.Err.Error()
		return result
	}
	if runResult.DiffFound {
		result.Status = StatusDiff
		return result
	}
	result.Status = StatusOK
	return result
}
