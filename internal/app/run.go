package app

import (
	"github.com/rea9r/apidiff/internal/diff"
	"github.com/rea9r/apidiff/internal/input"
	"github.com/rea9r/apidiff/internal/output"
)

func Run(args []string) (int, string, error) {
	cfg, err := parseArgs(args)
	if err != nil {
		return exitError, "", err
	}

	oldValue, err := input.LoadJSONFile(cfg.oldPath)
	if err != nil {
		return exitError, "", err
	}

	newValue, err := input.LoadJSONFile(cfg.newPath)
	if err != nil {
		return exitError, "", err
	}

	diffs := diff.Compare(oldValue, newValue)
	diffs = diff.ApplyOptions(diffs, cfg.diffOptions())

	out, err := output.Format(diffs, cfg.format)
	if err != nil {
		return exitError, "", err
	}

	if len(diffs) > 0 {
		return exitDiffFound, out, nil
	}
	return exitOK, out, nil
}
