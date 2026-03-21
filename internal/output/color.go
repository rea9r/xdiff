package output

import (
	"os"
	"strings"

	"github.com/rea9r/xdiff/internal/delta"
)

const (
	colorReset   = "\x1b[0m"
	colorRed     = "\x1b[31m"
	colorGreen   = "\x1b[32m"
	colorYellow  = "\x1b[33m"
	colorCyan    = "\x1b[36m"
	colorMagenta = "\x1b[35m"
)

func ShouldUseColor(noColor bool) bool {
	if noColor {
		return false
	}
	if os.Getenv("NO_COLOR") != "" {
		return false
	}

	term := strings.TrimSpace(os.Getenv("TERM"))
	if term == "" || term == "dumb" {
		return false
	}

	fi, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return fi.Mode()&os.ModeCharDevice != 0
}

func colorizeAction(action string, typ delta.DiffType, useColor bool) string {
	if !useColor {
		return action
	}

	colorCode := actionColor(typ)
	if colorCode == "" {
		return action
	}
	return colorCode + action + colorReset
}

func actionColor(typ delta.DiffType) string {
	switch typ {
	case delta.Added:
		return colorGreen
	case delta.Removed:
		return colorRed
	case delta.Changed:
		return colorYellow
	case delta.TypeChanged:
		return colorMagenta
	default:
		return ""
	}
}

func colorizeUnified(s string, useColor bool) string {
	if !useColor {
		return s
	}

	lines := strings.SplitAfter(s, "\n")
	var b strings.Builder
	for _, line := range lines {
		switch {
		case strings.HasPrefix(line, "+++"):
			b.WriteString(colorGreen + line + colorReset)
		case strings.HasPrefix(line, "---"):
			b.WriteString(colorRed + line + colorReset)
		case strings.HasPrefix(line, "@@"):
			b.WriteString(colorCyan + line + colorReset)
		case strings.HasPrefix(line, "+"):
			b.WriteString(colorGreen + line + colorReset)
		case strings.HasPrefix(line, "-"):
			b.WriteString(colorRed + line + colorReset)
		default:
			b.WriteString(line)
		}
	}
	return b.String()
}
