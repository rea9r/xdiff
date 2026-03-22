package scenario

import (
	"context"

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
		code, out, err := runner.RunJSONFiles(runner.Options{
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
		})
		return resultFromRun(check, code, out, err)

	case KindText:
		code, out, err := runner.RunTextFiles(runner.Options{
			Format:       check.Compare.Format,
			FailOn:       check.Compare.FailOn,
			IgnorePaths:  check.Compare.IgnorePaths,
			OnlyBreaking: check.Compare.OnlyBreaking,
			TextStyle:    check.Compare.TextStyle,
			ShowPaths:    check.Compare.ShowPaths,
			UseColor:     check.Compare.UseColor,
			OldPath:      check.Old,
			NewPath:      check.New,
		})
		return resultFromRun(check, code, out, err)

	case KindURL:
		load := func(rawURL string) runner.ValueLoader {
			return func(ctx context.Context) (any, error) {
				return source.LoadJSONURL(ctx, rawURL, source.HTTPOptions{
					Headers: check.Headers,
					Timeout: check.Timeout,
				})
			}
		}
		code, out, err := runner.RunJSONLoaders(load(check.Old), load(check.New), check.Compare)
		return resultFromRun(check, code, out, err)

	case KindSpec:
		oldSpec, err := source.LoadOpenAPISpecFile(check.Old)
		if err != nil {
			return resultFromRun(check, 2, "", err)
		}
		newSpec, err := source.LoadOpenAPISpecFile(check.New)
		if err != nil {
			return resultFromRun(check, 2, "", err)
		}
		diffs := openapi.ComparePathsMethods(oldSpec, newSpec)
		opts := check.Compare
		opts.PathFormatter = openapi.HumanizePath
		code, out, err := runner.RunDeltaDiffs(diffs, opts)
		return resultFromRun(check, code, out, err)
	default:
		return Result{
			Name:         check.Name,
			Kind:         check.Kind,
			Status:       StatusError,
			ExitCode:     2,
			ErrorMessage: "unsupported kind",
		}
	}
}

func resultFromRun(check ResolvedCheck, code int, out string, err error) Result {
	result := Result{
		Name:     check.Name,
		Kind:     check.Kind,
		ExitCode: code,
		Output:   out,
	}

	if err != nil {
		result.Status = StatusError
		result.ErrorMessage = err.Error()
		return result
	}
	if code == 1 {
		result.Status = StatusDiff
		return result
	}
	result.Status = StatusOK
	return result
}
