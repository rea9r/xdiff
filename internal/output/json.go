package output

import (
	"encoding/json"

	"github.com/rea9r/apidiff/internal/diff"
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
	Old     any          `json:"old,omitempty"`
	New     any          `json:"new,omitempty"`
	Diffs   []jsonDiff   `json:"diffs,omitempty"`
	Summary *jsonSummary `json:"summary,omitempty"`
}

func FormatJSON(diffs []diff.Diff) (string, error) {
	return RenderJSONWithOptions(nil, nil, diffs, JSONOptions{Scope: ScopeDiff})
}

type JSONOptions struct {
	Scope string
}

func RenderJSONWithOptions(oldValue, newValue any, diffs []diff.Diff, opts JSONOptions) (string, error) {
	scope := opts.Scope
	if scope == "" {
		scope = ScopeDiff
	}

	result := jsonResult{
		Diffs: make([]jsonDiff, 0, len(diffs)),
	}
	if scope == ScopeBoth {
		result.Old = oldValue
		result.New = newValue
	}

	if scope == ScopeDiff || scope == ScopeBoth {
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
	} else {
		result.Diffs = nil
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
