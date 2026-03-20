package output

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pmezard/go-difflib/difflib"
	"github.com/rea9r/apidiff/internal/diff"
)

func FormatText(diffs []diff.Diff) string {
	return RenderTextWithOptions(nil, nil, diffs, TextOptions{
		Color: false,
		Scope: ScopeDiff,
		View:  ViewSemantic,
	})
}

type TextOptions struct {
	Color   bool
	Scope   string
	View    string
	Summary string
}

func RenderTextWithOptions(oldValue, newValue any, diffs []diff.Diff, opts TextOptions) string {
	scope := opts.Scope
	if scope == "" {
		scope = ScopeDiff
	}
	view := opts.View
	if view == "" {
		view = ViewSemantic
	}
	summaryMode := opts.Summary
	if summaryMode == "" {
		summaryMode = SummaryAuto
	}

	var sections []string
	if scope == ScopeBoth {
		sections = append(sections, renderValueSection("OLD", oldValue))
		sections = append(sections, renderValueSection("NEW", newValue))
	}
	if scope == ScopeDiff || scope == ScopeBoth {
		sections = append(sections, renderDiffSection(oldValue, newValue, diffs, opts.Color, view, summaryMode))
	}
	rendered := strings.Join(sections, "\n\n")
	return strings.TrimRight(rendered, "\n") + "\n"
}

func renderDiffSection(oldValue, newValue any, diffs []diff.Diff, color bool, view string, summaryMode string) string {
	if view == ViewUnified {
		return renderUnifiedDiffSection(oldValue, newValue, diffs, color, summaryMode)
	}
	return renderSemanticDiffSection(diffs, color, summaryMode)
}

func renderSemanticDiffSection(diffs []diff.Diff, color bool, summaryMode string) string {
	summary := diff.Summarize(diffs)

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

	if shouldShowSummary(ViewSemantic, summaryMode) {
		b.WriteString("\nSummary:\n")
		fmt.Fprintf(&b, "  added: %d\n", summary.Added)
		fmt.Fprintf(&b, "  removed: %d\n", summary.Removed)
		fmt.Fprintf(&b, "  changed: %d\n", summary.Changed)
		fmt.Fprintf(&b, "  type_changed: %d\n", summary.TypeChanged)
	}

	return b.String()
}

func renderUnifiedDiffSection(oldValue, newValue any, diffs []diff.Diff, color bool, summaryMode string) string {
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

	var b strings.Builder
	b.WriteString(colorizeUnified(unified, color))

	if shouldShowSummary(ViewUnified, summaryMode) {
		summary := diff.Summarize(diffs)
		b.WriteString("\nSummary:\n")
		fmt.Fprintf(&b, "  added: %d\n", summary.Added)
		fmt.Fprintf(&b, "  removed: %d\n", summary.Removed)
		fmt.Fprintf(&b, "  changed: %d\n", summary.Changed)
		fmt.Fprintf(&b, "  type_changed: %d\n", summary.TypeChanged)
	}
	return b.String()
}

func shouldShowSummary(view, mode string) bool {
	switch mode {
	case SummaryAlways:
		return true
	case SummaryNever:
		return false
	case SummaryAuto:
		return view == ViewSemantic
	default:
		return false
	}
}

func renderValueSection(label string, value any) string {
	var b strings.Builder
	b.WriteString("=== " + label + " ===\n")
	b.WriteString(prettyJSON(value))
	return b.String()
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
