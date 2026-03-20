package app

import "github.com/rea9r/apidiff/internal/diff"

type config struct {
	format       string
	ignorePaths  []string
	onlyBreaking bool
	oldPath      string
	newPath      string
}

func (c config) diffOptions() diff.Options {
	return diff.Options{
		IgnorePaths:  c.ignorePaths,
		OnlyBreaking: c.onlyBreaking,
	}
}
