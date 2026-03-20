package output

import (
	"encoding/json"

	"github.com/rea9r/xdiff/internal/diff"
)

type jsonDiff struct {
	Type     diff.DiffType `json:"type"`
	Path     string        `json:"path"`
	OldValue any           `json:"old_value,omitempty"`
	NewValue any           `json:"new_value,omitempty"`
	OldType  string        `json:"old_type,omitempty"`
	NewType  string        `json:"new_type,omitempty"`
}

type jsonSummary struct {
	Added       int `json:"added"`
	Removed     int `json:"removed"`
	Changed     int `json:"changed"`
	TypeChanged int `json:"type_changed"`
}

type jsonResult struct {
	Diffs   []jsonDiff   `json:"diffs,omitempty"`
	Summary *jsonSummary `json:"summary,omitempty"`
}

func FormatJSON(diffs []diff.Diff) (string, error) {
	return RenderJSON(diffs)
}

func RenderJSON(diffs []diff.Diff) (string, error) {
	result := jsonResult{
		Diffs: make([]jsonDiff, 0, len(diffs)),
	}
	result.Summary = toJSONSummaryPtr(diff.Summarize(diffs))

	for _, d := range diffs {
		jd := jsonDiff{
			Type:     d.Type,
			Path:     d.Path,
			OldValue: d.OldValue,
			NewValue: d.NewValue,
		}
		if d.Type == diff.TypeChanged {
			jd.OldType = diff.ValueType(d.OldValue)
			jd.NewType = diff.ValueType(d.NewValue)
		}
		result.Diffs = append(result.Diffs, jd)
	}

	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data) + "\n", nil
}

func toJSONSummaryPtr(summary diff.Summary) *jsonSummary {
	return &jsonSummary{
		Added:       summary.Added,
		Removed:     summary.Removed,
		Changed:     summary.Changed,
		TypeChanged: summary.TypeChanged,
	}
}
