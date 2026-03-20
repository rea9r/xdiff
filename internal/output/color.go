package output

import (
	"os"
	"strings"

	"github.com/rea9r/apidiff/internal/diff"
)

const (
	colorReset   = "\x1b[0m"
	colorRed     = "\x1b[31m"
	colorGreen   = "\x1b[32m"
	colorYellow  = "\x1b[33m"
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

func colorizeAction(action string, typ diff.DiffType, useColor bool) string {
	if !useColor {
		return action
	}

	colorCode := actionColor(typ)
	if colorCode == "" {
		return action
	}
	return colorCode + action + colorReset
}

func actionColor(typ diff.DiffType) string {
	switch typ {
	case diff.Added:
		return colorGreen
	case diff.Removed:
		return colorRed
	case diff.Changed:
		return colorYellow
	case diff.TypeChanged:
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
		case strings.HasPrefix(line, "+++"), strings.HasPrefix(line, "---"):
			b.WriteString(colorMagenta + line + colorReset)
		case strings.HasPrefix(line, "@@"):
			b.WriteString(colorYellow + line + colorReset)
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
