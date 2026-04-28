package sample

import (
	"strings"
	"unicode"
)

// Title returns a normalized display name with the first
// non-space rune upper-cased.
func Title(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return trimmed
	}
	runes := []rune(trimmed)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}

// Dedup returns names with duplicates removed.
func Dedup(names []string) []string {
	lastIdx := map[string]int{}
	for i, n := range names {
		lastIdx[n] = i
	}
	out := make([]string, 0, len(lastIdx))
	for i, n := range names {
		if lastIdx[n] == i {
			out = append(out, n)
		}
	}
	return out
}

// Truncate clips s to maxRunes, appending an ellipsis when shortened.
func Truncate(s string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	return string(runes[:maxRunes-1]) + "…"
}
