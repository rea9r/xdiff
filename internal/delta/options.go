package delta

type Options struct {
	IgnorePaths []string
}

func ApplyOptions(diffs []Diff, opts Options) []Diff {
	return FilterIgnoredPaths(diffs, opts.IgnorePaths)
}
