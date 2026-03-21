package openapi

import "github.com/rea9r/xdiff/internal/delta"

func LabelDiffPaths(diffs []delta.Diff) []delta.Diff {
	if len(diffs) == 0 {
		return diffs
	}

	labeled := make([]delta.Diff, 0, len(diffs))
	for _, d := range diffs {
		clone := d
		if ref, ok := parsePathRef(d.Path); ok {
			clone.Path = ref.human()
		}
		labeled = append(labeled, clone)
	}
	return labeled
}
