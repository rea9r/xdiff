package desktopapi

import (
	"fmt"
	"os"
	"strings"
	"unicode/utf8"

	"github.com/rea9r/xdiff/internal/openapi"
	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/runner"
	"github.com/rea9r/xdiff/internal/scenario"
	"github.com/rea9r/xdiff/internal/source"
)

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func guiUseColor() bool {
	return false
}

func (s *Service) CompareJSONFiles(req CompareJSONRequest) (*CompareResponse, error) {
	opts := runner.Options{
		Format:       normalizeOutputFormat(req.Common.OutputFormat),
		FailOn:       req.Common.FailOn,
		IgnorePaths:  append([]string(nil), req.Common.IgnorePaths...),
		ShowPaths:    req.Common.ShowPaths,
		OnlyBreaking: req.Common.OnlyBreaking,
		TextStyle:    req.Common.TextStyle,
		IgnoreOrder:  req.IgnoreOrder,
		UseColor:     guiUseColor(),
		OldPath:      req.OldPath,
		NewPath:      req.NewPath,
	}

	res := runner.RunJSONFilesDetailed(opts)
	return &CompareResponse{
		ExitCode:  res.ExitCode,
		DiffFound: res.DiffFound,
		Output:    res.Output,
		Error:     errString(res.Err),
	}, nil
}

func (s *Service) CompareSpecFiles(req CompareSpecRequest) (*CompareResponse, error) {
	oldSpec, err := source.LoadOpenAPISpecFile(req.OldPath)
	if err != nil {
		return &CompareResponse{ExitCode: 2, Error: err.Error()}, nil
	}
	newSpec, err := source.LoadOpenAPISpecFile(req.NewPath)
	if err != nil {
		return &CompareResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	diffs := openapi.ComparePathsMethods(oldSpec, newSpec)
	opts := runner.CompareOptions{
		Format:        normalizeOutputFormat(req.Common.OutputFormat),
		FailOn:        req.Common.FailOn,
		IgnorePaths:   append([]string(nil), req.Common.IgnorePaths...),
		ShowPaths:     req.Common.ShowPaths,
		OnlyBreaking:  req.Common.OnlyBreaking,
		TextStyle:     req.Common.TextStyle,
		UseColor:      guiUseColor(),
		PathFormatter: openapi.HumanizePath,
	}

	res := runner.RunDeltaDiffsDetailed(diffs, opts)
	return &CompareResponse{
		ExitCode:  res.ExitCode,
		DiffFound: res.DiffFound,
		Output:    res.Output,
		Error:     errString(res.Err),
	}, nil
}

func (s *Service) CompareText(req CompareTextRequest) (*CompareResponse, error) {
	opts := runner.CompareOptions{
		Format:       normalizeOutputFormat(req.Common.OutputFormat),
		FailOn:       req.Common.FailOn,
		IgnorePaths:  append([]string(nil), req.Common.IgnorePaths...),
		ShowPaths:    req.Common.ShowPaths,
		OnlyBreaking: req.Common.OnlyBreaking,
		TextStyle:    req.Common.TextStyle,
		UseColor:     guiUseColor(),
	}

	res := runner.RunTextValuesDetailed(req.OldText, req.NewText, opts)
	return &CompareResponse{
		ExitCode:  res.ExitCode,
		DiffFound: res.DiffFound,
		Output:    res.Output,
		Error:     errString(res.Err),
	}, nil
}

func (s *Service) LoadTextFile(req LoadTextFileRequest) (*LoadTextFileResponse, error) {
	path := strings.TrimSpace(req.Path)
	if path == "" {
		return nil, fmt.Errorf("path is required")
	}

	body, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	if !utf8.Valid(body) {
		return nil, fmt.Errorf("selected file is not valid UTF-8 text: %s", path)
	}

	return &LoadTextFileResponse{
		Path:    path,
		Content: string(body),
	}, nil
}

func (s *Service) RunScenario(req RunScenarioRequest) (*ScenarioRunResponse, error) {
	cfg, err := scenario.LoadFile(req.ScenarioPath)
	if err != nil {
		return &ScenarioRunResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	checks, err := scenario.Resolve(cfg, req.ScenarioPath)
	if err != nil {
		return &ScenarioRunResponse{ExitCode: 2, Error: err.Error()}, nil
	}
	checks, err = scenario.FilterResolvedChecks(checks, req.Only)
	if err != nil {
		return &ScenarioRunResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	summary, results := scenario.RunResolved(checks)
	out, err := renderScenarioReport(req.ReportFormat, summary, results, req.ScenarioPath)
	if err != nil {
		return &ScenarioRunResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	return &ScenarioRunResponse{
		ExitCode: summary.ExitCode,
		Summary: &ScenarioSummary{
			Total:    summary.Total,
			OK:       summary.OK,
			Diff:     summary.Diff,
			Error:    summary.Error,
			ExitCode: summary.ExitCode,
		},
		Results: mapScenarioResults(results),
		Output:  out,
	}, nil
}

func (s *Service) ListScenarioChecks(req ListScenarioChecksRequest) (*ScenarioListResponse, error) {
	cfg, err := scenario.LoadFile(req.ScenarioPath)
	if err != nil {
		return &ScenarioListResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	checks, err := scenario.Resolve(cfg, req.ScenarioPath)
	if err != nil {
		return &ScenarioListResponse{ExitCode: 2, Error: err.Error()}, nil
	}
	checks, err = scenario.FilterResolvedChecks(checks, req.Only)
	if err != nil {
		return &ScenarioListResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	entries := scenario.BuildCheckListEntries(checks, req.ScenarioPath)
	mapped := make([]ScenarioCheckListEntry, 0, len(entries))
	for _, e := range entries {
		mapped = append(mapped, ScenarioCheckListEntry{
			Name:    e.Name,
			Kind:    e.Kind,
			Old:     e.Old,
			New:     e.New,
			Summary: e.Summary,
		})
	}

	out, err := renderScenarioList(req.ReportFormat, checks, req.ScenarioPath)
	if err != nil {
		return &ScenarioListResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	return &ScenarioListResponse{
		ExitCode: 0,
		Checks:   mapped,
		Output:   out,
	}, nil
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func normalizeOutputFormat(v string) string {
	if v == "" {
		return output.TextFormat
	}
	return v
}

func renderScenarioReport(format string, summary scenario.Summary, results []scenario.Result, scenarioPath string) (string, error) {
	switch format {
	case "", output.TextFormat:
		return scenario.RenderText(summary, results, scenarioPath), nil
	case output.JSONFormat:
		return scenario.RenderJSON(summary, results)
	default:
		return "", fmt.Errorf("invalid report format %q (allowed: text, json)", format)
	}
}

func renderScenarioList(format string, checks []scenario.ResolvedCheck, scenarioPath string) (string, error) {
	switch format {
	case "", output.TextFormat:
		return scenario.RenderCheckListText(checks, scenarioPath), nil
	case output.JSONFormat:
		return scenario.RenderCheckListJSON(checks, scenarioPath)
	default:
		return "", fmt.Errorf("invalid report format %q (allowed: text, json)", format)
	}
}

func mapScenarioResults(in []scenario.Result) []ScenarioResult {
	out := make([]ScenarioResult, 0, len(in))
	for _, r := range in {
		out = append(out, ScenarioResult{
			Name:         r.Name,
			Kind:         r.Kind,
			Status:       r.Status,
			ExitCode:     r.ExitCode,
			DiffFound:    r.DiffFound,
			Output:       r.Output,
			ErrorMessage: r.ErrorMessage,
		})
	}
	return out
}
