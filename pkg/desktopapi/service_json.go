package desktopapi

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/runner"
)

type jsonMachineDiffItem struct {
	Type     string `json:"type"`
	Path     string `json:"path"`
	OldValue any    `json:"old_value,omitempty"`
	NewValue any    `json:"new_value,omitempty"`
}

type jsonMachineResult struct {
	Diffs []jsonMachineDiffItem `json:"diffs"`
}

func (s *Service) DiffJSONFiles(req DiffJSONRequest) (*DiffResponse, error) {
	opts := runner.Options{
		DiffOptions: runner.DiffOptions{
			Format:      normalizeOutputFormat(req.Common.OutputFormat),
			IgnorePaths: append([]string(nil), req.Common.IgnorePaths...),
			TextStyle:   req.Common.TextStyle,
			IgnoreOrder: req.IgnoreOrder,
		},
		OldPath: req.OldPath,
		NewPath: req.NewPath,
	}

	res := runner.RunJSONFilesDetailed(opts)
	return &DiffResponse{
		ExitCode:  res.ExitCode,
		DiffFound: res.DiffFound,
		Output:    res.Output,
		Error:     errString(res.Err),
	}, nil
}

func (s *Service) DiffJSONRich(req DiffJSONRequest) (*DiffJSONRichResponse, error) {
	rawResult, err := s.DiffJSONFiles(req)
	if err != nil {
		return nil, err
	}

	diffReq := req
	diffReq.Common.OutputFormat = "text"
	diffReq.Common.TextStyle = "patch"
	diffResult, err := s.DiffJSONFiles(diffReq)
	if err != nil {
		return nil, err
	}

	structuredReq := req
	structuredReq.Common.OutputFormat = output.JSONFormat

	structuredResult, err := s.DiffJSONFiles(structuredReq)
	if err != nil {
		return nil, err
	}

	diffs, err := parseJSONMachineDiffs(structuredResult.Output)
	if err != nil {
		return nil, err
	}

	return &DiffJSONRichResponse{
		Result:   *rawResult,
		DiffText: pickDiffText(diffResult.Output, rawResult.Output),
		Summary:  summarizeJSONRichDiffs(diffs),
		Diffs:    diffs,
	}, nil
}

func (s *Service) DiffJSONValuesRich(req DiffJSONValuesRequest) (*DiffJSONRichResponse, error) {
	var oldValue any
	if err := json.Unmarshal([]byte(req.OldValue), &oldValue); err != nil {
		return nil, fmt.Errorf("invalid old JSON: %w", err)
	}

	var newValue any
	if err := json.Unmarshal([]byte(req.NewValue), &newValue); err != nil {
		return nil, fmt.Errorf("invalid new JSON: %w", err)
	}

	rawOpts := runner.DiffOptions{
		Format:      normalizeOutputFormat(req.Common.OutputFormat),
		IgnorePaths: append([]string(nil), req.Common.IgnorePaths...),
		TextStyle:   req.Common.TextStyle,
		IgnoreOrder: req.IgnoreOrder,
	}
	rawRun := runner.RunJSONValuesDetailed(oldValue, newValue, rawOpts)
	rawResult := DiffResponse{
		ExitCode:  rawRun.ExitCode,
		DiffFound: rawRun.DiffFound,
		Output:    rawRun.Output,
		Error:     errString(rawRun.Err),
	}

	structuredOpts := rawOpts
	structuredOpts.Format = output.JSONFormat
	structuredRun := runner.RunJSONValuesDetailed(oldValue, newValue, structuredOpts)

	diffOpts := rawOpts
	diffOpts.Format = output.TextFormat
	diffOpts.TextStyle = "patch"
	diffRun := runner.RunJSONValuesDetailed(oldValue, newValue, diffOpts)

	diffs, err := parseJSONMachineDiffs(structuredRun.Output)
	if err != nil {
		return nil, err
	}

	return &DiffJSONRichResponse{
		Result:   rawResult,
		DiffText: pickDiffText(diffRun.Output, rawResult.Output),
		Summary:  summarizeJSONRichDiffs(diffs),
		Diffs:    diffs,
	}, nil
}

func parseJSONMachineDiffs(raw string) ([]JSONRichDiffItem, error) {
	diffs := make([]JSONRichDiffItem, 0)
	if strings.TrimSpace(raw) == "" {
		return diffs, nil
	}

	var parsed jsonMachineResult
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse structured JSON diff output: %w", err)
	}

	diffs = make([]JSONRichDiffItem, 0, len(parsed.Diffs))
	for _, item := range parsed.Diffs {
		diffs = append(diffs, JSONRichDiffItem(item))
	}

	return diffs, nil
}

func summarizeJSONRichDiffs(diffs []JSONRichDiffItem) JSONRichSummary {
	summary := JSONRichSummary{}
	for _, diff := range diffs {
		switch diff.Type {
		case "added":
			summary.Added++
		case "removed":
			summary.Removed++
		case "changed":
			summary.Changed++
		case "type_changed":
			summary.TypeChanged++
		}
	}

	return summary
}
