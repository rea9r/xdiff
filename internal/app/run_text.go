package app

import (
	"os"

	"github.com/rea9r/xdiff/internal/diff"
	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/textdiff"
)

func RunTextWithOptions(opts Options) (int, string, error) {
	if err := validateFileOptions(opts); err != nil {
		return exitError, "", err
	}

	oldData, err := os.ReadFile(opts.OldPath)
	if err != nil {
		return exitError, "", err
	}
	newData, err := os.ReadFile(opts.NewPath)
	if err != nil {
		return exitError, "", err
	}

	return RunWithText(string(oldData), string(newData), opts.CompareOptions())
}

func RunWithText(oldText, newText string, opts CompareOptions) (int, string, error) {
	if err := validateCompareOptions(opts); err != nil {
		return exitError, "", err
	}

	diffs := textdiff.Compare(oldText, newText)
	filtered := diff.ApplyOptions(diffs, diff.Options{
		IgnorePaths:  opts.IgnorePaths,
		OnlyBreaking: opts.OnlyBreaking,
	})

	var out string
	switch opts.Format {
	case output.TextFormat:
		if len(filtered) == 0 {
			out = "No differences.\n"
		} else {
			out = output.RenderUnifiedTextWithColor(oldText, newText, output.ShouldUseColor(opts.NoColor))
		}
	case output.JSONFormat:
		rendered, err := output.RenderJSON(filtered)
		if err != nil {
			return exitError, "", err
		}
		out = rendered
	}

	hasFailure := HasFailureByMode(filtered, opts.FailOn)
	out = decorateTextResult(opts.Format, opts.FailOn, hasFailure, filtered, out)
	if hasFailure {
		return exitDiffFound, out, nil
	}
	return exitOK, out, nil
}
