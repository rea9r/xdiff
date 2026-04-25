package sample

import "strings"

// Title returns a normalized display name.
func Title(name string) string {
	return strings.TrimSpace(name)
}
