package textdiff

import (
	"fmt"
	"strings"

	"github.com/pmezard/go-difflib/difflib"
	"github.com/rea9r/xdiff/internal/diff"
)

func Compare(oldText, newText string) []diff.Diff {
	oldLines := difflib.SplitLines(oldText)
	newLines := difflib.SplitLines(newText)

	matcher := difflib.NewMatcher(oldLines, newLines)
	opCodes := matcher.GetOpCodes()

	out := make([]diff.Diff, 0)
	for _, op := range opCodes {
		switch op.Tag {
		case 'd':
			for i := op.I1; i < op.I2; i++ {
				out = append(out, diff.Diff{
					Type:     diff.Removed,
					Path:     linePath(i + 1),
					OldValue: normalizeLine(oldLines[i]),
				})
			}
		case 'i':
			for j := op.J1; j < op.J2; j++ {
				out = append(out, diff.Diff{
					Type:     diff.Added,
					Path:     linePath(j + 1),
					NewValue: normalizeLine(newLines[j]),
				})
			}
		case 'r':
			for i := op.I1; i < op.I2; i++ {
				out = append(out, diff.Diff{
					Type:     diff.Removed,
					Path:     linePath(i + 1),
					OldValue: normalizeLine(oldLines[i]),
				})
			}
			for j := op.J1; j < op.J2; j++ {
				out = append(out, diff.Diff{
					Type:     diff.Added,
					Path:     linePath(j + 1),
					NewValue: normalizeLine(newLines[j]),
				})
			}
		}
	}

	return out
}

func linePath(line int) string {
	return fmt.Sprintf("line[%d]", line)
}

func normalizeLine(line string) string {
	return strings.TrimSuffix(line, "\n")
}
