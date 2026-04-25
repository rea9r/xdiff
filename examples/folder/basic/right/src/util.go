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
