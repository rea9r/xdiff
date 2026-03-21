package runner

import (
	"os"

	"github.com/rea9r/xdiff/internal/delta"
	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/textdiff"
)

func RunTextFiles(opts Options) (int, string, error) {
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

	return RunTextValues(string(oldData), string(newData), opts.CompareOptions())
}

func RunTextValues(oldText, newText string, opts CompareOptions) (int, string, error) {
	if err := validateCompareOptions(opts); err != nil {
		return exitError, "", err
	}

	diffs := textdiff.Compare(oldText, newText)
	filtered := delta.ApplyOptions(diffs, delta.Options{
		IgnorePaths:  opts.IgnorePaths,
		OnlyBreaking: opts.OnlyBreaking,
	})

	var out string
	switch opts.Format {
	case output.TextFormat:
		if len(filtered) == 0 {
			out = "No differences.\n"
		} else if len(opts.IgnorePaths) > 0 || opts.OnlyBreaking {
			out = output.RenderSemanticTextWithColor(filtered, opts.UseColor)
		} else {
			out = output.RenderUnifiedTextWithColor(oldText, newText, opts.UseColor)
		}
	case output.JSONFormat:
		rendered, err := output.RenderJSON(filtered)
		if err != nil {
			return exitError, "", err
		}
		out = rendered
	}

	hasFailure := HasFailureByMode(filtered, opts.FailOn)
	if hasFailure {
		return exitDiffFound, out, nil
	}
	return exitOK, out, nil
}
