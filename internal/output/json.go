package output

import (
	"encoding/json"
	"reflect"

	"github.com/rea9r/xdiff/internal/delta"
)

type jsonDiff struct {
	Type     delta.DiffType `json:"type"`
	Path     string         `json:"path"`
	OldValue *any           `json:"old_value,omitempty"`
	NewValue *any           `json:"new_value,omitempty"`
	OldType  string         `json:"old_type,omitempty"`
	NewType  string         `json:"new_type,omitempty"`
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

func FormatJSON(diffs []delta.Diff) (string, error) {
	return RenderJSON(diffs)
}

func RenderJSON(diffs []delta.Diff) (string, error) {
	result := jsonResult{
		Diffs: make([]jsonDiff, 0, len(diffs)),
	}
	result.Summary = toJSONSummaryPtr(delta.Summarize(diffs))

	for _, d := range diffs {
		jd := jsonDiff{
			Type:     d.Type,
			Path:     d.Path,
			OldValue: toOptionalJSONValue(d.OldValue),
			NewValue: toOptionalJSONValue(d.NewValue),
		}
		if d.Type == delta.TypeChanged {
			jd.OldType = delta.ValueType(d.OldValue)
			jd.NewType = delta.ValueType(d.NewValue)
		}
		result.Diffs = append(result.Diffs, jd)
	}

	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data) + "\n", nil
}

func toJSONSummaryPtr(summary delta.Summary) *jsonSummary {
	return &jsonSummary{
		Added:       summary.Added,
		Removed:     summary.Removed,
		Changed:     summary.Changed,
		TypeChanged: summary.TypeChanged,
	}
}

func toOptionalJSONValue(value any) *any {
	if isNilJSONValue(value) {
		return nil
	}
	copied := value
	return &copied
}

func isNilJSONValue(value any) bool {
	if value == nil {
		return true
	}

	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Pointer, reflect.Slice:
		return rv.IsNil()
	default:
		return false
	}
}
