package output

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pmezard/go-difflib/difflib"
	"github.com/rea9r/xdiff/internal/delta"
)

func FormatText(diffs []delta.Diff) string {
	return RenderSemanticTextWithColor(diffs, false)
}

func RenderSemanticTextWithColor(diffs []delta.Diff, color bool) string {
	return renderSemanticDiffSection(diffs, color)
}

func renderSemanticDiffSection(diffs []delta.Diff, color bool) string {
	var b strings.Builder

	if len(diffs) == 0 {
		b.WriteString("No differences.\n")
	} else {
		for _, d := range diffs {
			marker := colorizeAction(diffMarker(d.Type), d.Type, color)
			path := d.Path
			if path == "" {
				path = "(root)"
			}

			detail := formatDetail(d)
			fmt.Fprintf(&b, "%s %s: %s\n", marker, path, detail)
		}
	}
	return b.String()
}

func RenderUnifiedJSONWithColor(oldValue, newValue any, color bool) string {
	oldText := prettyJSON(oldValue)
	newText := prettyJSON(newValue)
	return renderUnifiedText(oldText, newText, color)
}

func RenderUnifiedText(oldText, newText string) string {
	return RenderUnifiedTextWithColor(oldText, newText, false)
}

func RenderUnifiedTextWithColor(oldText, newText string, color bool) string {
	return renderUnifiedText(oldText, newText, color)
}

func renderUnifiedText(oldText, newText string, color bool) string {

	ud := difflib.UnifiedDiff{
		A:        difflib.SplitLines(oldText),
		B:        difflib.SplitLines(newText),
		FromFile: "old",
		ToFile:   "new",
		Context:  3,
	}
	unified, err := difflib.GetUnifiedDiffString(ud)
	if err != nil {
		return "failed to render unified diff\n"
	}

	return colorizeUnified(unified, color)
}

func formatDetail(d delta.Diff) string {
	switch d.Type {
	case delta.Added:
		return formatValue(d.NewValue)
	case delta.Removed:
		return formatValue(d.OldValue)
	case delta.TypeChanged:
		return fmt.Sprintf("%s -> %s", delta.ValueType(d.OldValue), delta.ValueType(d.NewValue))
	case delta.Changed:
		return fmt.Sprintf("%s -> %s", formatValue(d.OldValue), formatValue(d.NewValue))
	default:
		return ""
	}
}

func formatValue(v any) string {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(data)
}

func prettyJSON(v any) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v\n", v)
	}
	return string(data) + "\n"
}

func diffMarker(typ delta.DiffType) string {
	switch typ {
	case delta.Added:
		return "+"
	case delta.Removed:
		return "-"
	case delta.Changed:
		return "~"
	case delta.TypeChanged:
		return "!"
	default:
		return "?"
	}
}
