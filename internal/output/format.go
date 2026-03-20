package output

import (
	"fmt"

	"github.com/rea9r/apidiff/internal/diff"
)

const (
	TextFormat = "text"
	JSONFormat = "json"
)

func Format(diffs []diff.Diff, format string) (string, error) {
	switch format {
	case TextFormat:
		return FormatText(diffs), nil
	case JSONFormat:
		return FormatJSON(diffs)
	default:
		return "", fmt.Errorf("unsupported format %q", format)
	}
}

func IsSupportedFormat(format string) bool {
	return format == TextFormat || format == JSONFormat
}
