package output

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pmezard/go-difflib/difflib"
	"github.com/rea9r/xdiff/internal/diff"
)

func FormatText(diffs []diff.Diff) string {
	return RenderTextWithOptions(nil, nil, diffs, TextOptions{
		Color: false,
	})
}

type TextOptions struct {
	Color bool
}

func RenderTextWithOptions(oldValue, newValue any, diffs []diff.Diff, opts TextOptions) string {
	if oldValue == nil && newValue == nil {
		return renderSemanticDiffSection(diffs, opts.Color)
	}
	return renderUnifiedDiffSection(oldValue, newValue, opts.Color)
}

func renderSemanticDiffSection(diffs []diff.Diff, color bool) string {
	var b strings.Builder

	if len(diffs) == 0 {
		b.WriteString("No differences.\n")
	} else {
		for _, d := range diffs {
			marker := colorizeAction(diffMarker(d.Type), d.Type, color)
			path := humanizeDiffPath(d.Path)
			if path == "" {
				path = "(root)"
			}

			detail := formatDetail(d)
			fmt.Fprintf(&b, "%s %s: %s\n", marker, path, detail)
		}
	}
	return b.String()
}

func renderUnifiedDiffSection(oldValue, newValue any, color bool) string {
	oldText := prettyJSON(oldValue)
	newText := prettyJSON(newValue)

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

func formatDetail(d diff.Diff) string {
	switch d.Type {
	case diff.Added:
		return formatValue(d.NewValue)
	case diff.Removed:
		return formatValue(d.OldValue)
	case diff.TypeChanged:
		return fmt.Sprintf("%s -> %s", diff.ValueType(d.OldValue), diff.ValueType(d.NewValue))
	case diff.Changed:
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

func diffMarker(typ diff.DiffType) string {
	switch typ {
	case diff.Added:
		return "+"
	case diff.Removed:
		return "-"
	case diff.Changed:
		return "~"
	case diff.TypeChanged:
		return "!"
	default:
		return "?"
	}
}

func humanizeDiffPath(path string) string {
	const prefix = "paths."
	if !strings.HasPrefix(path, prefix) {
		return path
	}

	parts := strings.Split(path[len(prefix):], ".")
	if len(parts) < 2 {
		return path
	}

	apiPath := parts[0]
	method := strings.ToUpper(parts[1])

	switch {
	case len(parts) == 2:
		return method + " " + apiPath
	case len(parts) >= 4 && parts[2] == "requestBody" && parts[3] == "required":
		return method + " " + apiPath + " request body required"
	case len(parts) >= 7 && parts[2] == "responses" && parts[4] == "content":
		statusCode := parts[3]
		contentType := parts[5]
		detail := strings.Join(parts[6:], ".")
		if detail == "schema.type" {
			return method + " " + apiPath + " response " + statusCode + " " + contentType + " schema type"
		}
	}

	return path
}
