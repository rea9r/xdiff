package runner

import (
	"github.com/rea9r/xdiff/internal/delta"
	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/textdiff"
)

func RunTextValues(oldText, newText string, opts DiffOptions) (int, string, error) {
	return RunTextValuesDetailed(oldText, newText, opts).Triple()
}

func RunTextValuesDetailed(oldText, newText string, opts DiffOptions) RunResult {
	if err := validateDiffOptions(opts); err != nil {
		return finalizeRun(nil, "", err)
	}

	normOpts := textdiff.NormalizeOptions{
		IgnoreWhitespace: opts.IgnoreWhitespace,
		IgnoreCase:       opts.IgnoreCase,
		IgnoreEOL:        opts.IgnoreEOL,
	}
	oldText = textdiff.Normalize(oldText, normOpts)
	newText = textdiff.Normalize(newText, normOpts)

	diffs := textdiff.Compare(oldText, newText)
	filtered := delta.ApplyOptions(diffs, delta.Options{
		IgnorePaths: opts.IgnorePaths,
	})

	var out string
	switch opts.Format {
	case output.TextFormat:
		style, err := resolveTextDiffStyle(opts)
		if err != nil {
			return finalizeRun(filtered, "", err)
		}

		if len(filtered) == 0 {
			out = "No differences.\n"
			break
		}

		if style == TextStyleSemantic {
			out = output.RenderSemanticText(filtered, output.SemanticTextOptions{
				UseColor: opts.UseColor,
			})
		} else {
			out = output.RenderUnifiedTextWithColor(oldText, newText, opts.UseColor)
		}
	case output.JSONFormat:
		rendered, err := output.RenderJSON(filtered)
		if err != nil {
			return finalizeRun(filtered, "", err)
		}
		out = rendered
	}

	return finalizeRun(filtered, out, nil)
}
