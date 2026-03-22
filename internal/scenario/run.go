package scenario

import (
	"context"
	"fmt"

	"github.com/rea9r/xdiff/internal/openapi"
	"github.com/rea9r/xdiff/internal/runner"
	"github.com/rea9r/xdiff/internal/source"
)

func Run(cfg Config, scenarioPath string) (Summary, []Result, error) {
	checks, err := Resolve(cfg, scenarioPath)
	if err != nil {
		return Summary{}, nil, err
	}

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

	return summary, results, nil
}

func runCheck(check ResolvedCheck) Result {
	switch check.Kind {
	case KindJSON:
		return resultFromRun(check, runner.RunJSONFilesDetailed(runner.Options{
			Format:       check.Compare.Format,
			FailOn:       check.Compare.FailOn,
			IgnorePaths:  check.Compare.IgnorePaths,
			OnlyBreaking: check.Compare.OnlyBreaking,
			IgnoreOrder:  check.Compare.IgnoreOrder,
			TextStyle:    check.Compare.TextStyle,
			ShowPaths:    check.Compare.ShowPaths,
			UseColor:     check.Compare.UseColor,
			OldPath:      check.Old,
			NewPath:      check.New,
		}))

	case KindText:
		return resultFromRun(check, runner.RunTextFilesDetailed(runner.Options{
			Format:       check.Compare.Format,
			FailOn:       check.Compare.FailOn,
			IgnorePaths:  check.Compare.IgnorePaths,
			OnlyBreaking: check.Compare.OnlyBreaking,
			TextStyle:    check.Compare.TextStyle,
			ShowPaths:    check.Compare.ShowPaths,
			UseColor:     check.Compare.UseColor,
			OldPath:      check.Old,
			NewPath:      check.New,
		}))

	case KindURL:
		load := func(rawURL string) runner.ValueLoader {
			return func(ctx context.Context) (any, error) {
				return source.LoadJSONURL(ctx, rawURL, source.HTTPOptions{
					Headers: check.Headers,
					Timeout: check.Timeout,
				})
			}
		}
		return resultFromRun(check, runner.RunJSONLoadersDetailed(load(check.Old), load(check.New), check.Compare))

	case KindSpec:
		oldSpec, err := source.LoadOpenAPISpecFile(check.Old)
		if err != nil {
			return resultFromRun(check, runner.RunResult{
				ExitCode: 2,
				Err:      err,
			})
		}
		newSpec, err := source.LoadOpenAPISpecFile(check.New)
		if err != nil {
			return resultFromRun(check, runner.RunResult{
				ExitCode: 2,
				Err:      err,
			})
		}
		diffs := openapi.ComparePathsMethods(oldSpec, newSpec)
		opts := check.Compare
		opts.PathFormatter = openapi.HumanizePath
		return resultFromRun(check, runner.RunDeltaDiffsDetailed(diffs, opts))
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
