package diff

type Options struct {
	IgnorePaths  []string
	OnlyBreaking bool
}

func ApplyOptions(diffs []Diff, opts Options) []Diff {
	filtered := FilterIgnoredPaths(diffs, opts.IgnorePaths)
	if opts.OnlyBreaking {
		filtered = FilterOnlyBreaking(filtered)
	}
	return filtered
}
