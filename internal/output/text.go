package output

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/rea9r/apidiff/internal/diff"
)

func FormatText(diffs []diff.Diff) string {
	counts := map[diff.DiffType]int{
		diff.Added:       0,
		diff.Removed:     0,
		diff.Changed:     0,
		diff.TypeChanged: 0,
	}

	var b strings.Builder

	if len(diffs) == 0 {
		b.WriteString("No differences.\n")
	} else {
		for _, d := range diffs {
			counts[d.Type]++

			action := strings.ToUpper(string(d.Type))
			path := d.Path
			if path == "" {
				path = "(root)"
			}

			detail := formatDetail(d)
			fmt.Fprintf(&b, "%-12s %-30s %s\n", action, path, detail)
		}
	}

	b.WriteString("\nSummary:\n")
	fmt.Fprintf(&b, "  added: %d\n", counts[diff.Added])
	fmt.Fprintf(&b, "  removed: %d\n", counts[diff.Removed])
	fmt.Fprintf(&b, "  changed: %d\n", counts[diff.Changed])
	fmt.Fprintf(&b, "  type_changed: %d\n", counts[diff.TypeChanged])

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
