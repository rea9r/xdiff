package app

import (
	"github.com/rea9r/apidiff/internal/diff"
	"github.com/rea9r/apidiff/internal/input"
	"github.com/rea9r/apidiff/internal/output"
)

func Run(args []string) (int, string, error) {
	cfg, err := parseArgs(args)
	if err != nil {
		return 2, "", err
	}

	oldValue, err := input.LoadJSONFile(cfg.oldPath)
	if err != nil {
		return 2, "", err
	}

	newValue, err := input.LoadJSONFile(cfg.newPath)
	if err != nil {
		return 2, "", err
	}

	diffs := diff.Compare(oldValue, newValue)
	out, err := output.Format(diffs, cfg.format)
	if err != nil {
		return 2, "", err
	}

	if len(diffs) > 0 {
		return 1, out, nil
	}
	return 0, out, nil
}

type config struct {
	format  string
	oldPath string
	newPath string
}
