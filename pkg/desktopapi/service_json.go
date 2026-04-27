package desktopapi

import (
	"encoding/json"
	"fmt"

	"github.com/rea9r/xdiff/internal/delta"
	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/runner"
)

func (s *Service) DiffJSONValuesRich(req DiffJSONValuesRequest) (*DiffJSONRichResponse, error) {
	var oldValue any
	if err := json.Unmarshal([]byte(req.OldValue), &oldValue); err != nil {
		return nil, fmt.Errorf("invalid old JSON: %w", err)
	}

	var newValue any
	if err := json.Unmarshal([]byte(req.NewValue), &newValue); err != nil {
		return nil, fmt.Errorf("invalid new JSON: %w", err)
	}

	opts := runner.DiffOptions{
		Format:      normalizeOutputFormat(req.Common.OutputFormat),
		IgnorePaths: append([]string(nil), req.Common.IgnorePaths...),
		TextStyle:   req.Common.TextStyle,
		IgnoreOrder: req.IgnoreOrder,
	}
	run := runner.RunJSONValuesDetailed(oldValue, newValue, opts)
	rawResult := DiffResponse{
		ExitCode:  run.ExitCode,
		DiffFound: run.DiffFound,
		Output:    run.Output,
		Error:     errString(run.Err),
	}

	structured := buildStructuredDiffs(run.Diffs)
	return &DiffJSONRichResponse{
		Result:   rawResult,
		DiffText: pickDiffText(buildPatchDiffText(oldValue, newValue, opts, run.DiffFound), rawResult.Output),
		Summary:  summarizeJSONRichDiffs(structured),
		Diffs:    structured,
	}, nil
}

func buildPatchDiffText(oldValue, newValue any, opts runner.DiffOptions, diffFound bool) string {
	if opts.IgnoreOrder || len(opts.IgnorePaths) > 0 {
		return ""
	}
	if !diffFound {
		return "No differences.\n"
	}
	return output.RenderUnifiedJSON(oldValue, newValue)
}

func buildStructuredDiffs(diffs []delta.Diff) []JSONRichDiffItem {
	out := make([]JSONRichDiffItem, 0, len(diffs))
	for _, d := range diffs {
		out = append(out, JSONRichDiffItem{
			Type:     string(d.Type),
			Path:     d.Path,
			OldValue: d.OldValue,
			NewValue: d.NewValue,
		})
	}
	return out
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
