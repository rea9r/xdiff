package sample

import "strings"

// Title returns a normalized display name.
func Title(name string) string {
	return strings.TrimSpace(name)
}

// Dedup returns names with duplicates removed, keeping the first
// occurrence of each name.
func Dedup(names []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(names))
	for _, n := range names {
		if seen[n] {
			continue
		}
		seen[n] = true
		out = append(out, n)
	}
	return out
}
