package runner

import (
	"fmt"

	"github.com/rea9r/xdiff/internal/delta"
	"github.com/rea9r/xdiff/internal/jsondiff"
	"github.com/rea9r/xdiff/internal/output"
)

func RunJSONValues(oldValue, newValue any, opts DiffOptions) (int, string, error) {
	return RunJSONValuesDetailed(oldValue, newValue, opts).Triple()
}

func RunJSONValuesDetailed(oldValue, newValue any, opts DiffOptions) RunResult {
	if err := validateDiffOptions(opts); err != nil {
		return finalizeRun(nil, "", err)
	}

	diffs, err := jsondiff.CompareWithOptions(oldValue, newValue, jsondiff.Options{
		IgnoreOrder: opts.IgnoreOrder,
	})
	if err != nil {
		return finalizeRun(nil, "", err)
	}
	diffs = delta.ApplyOptions(diffs, delta.Options{
		IgnorePaths: opts.IgnorePaths,
	})

	var out string
	switch opts.Format {
	case output.TextFormat:
		style, err := resolveJSONTextStyle(opts)
		if err != nil {
			return finalizeRun(diffs, "", err)
		}

		if len(diffs) == 0 {
			out = "No differences.\n"
			break
		}
		if style == TextStyleSemantic {
			out = output.RenderSemanticText(diffs)
			break
		}
		out = output.RenderUnifiedJSON(oldValue, newValue)
	case output.JSONFormat:
		rendered, err := output.RenderJSON(diffs)
		if err != nil {
			return finalizeRun(diffs, "", err)
		}
		out = rendered
	}

	return finalizeRun(diffs, out, nil)
}

func validateDiffOptions(opts DiffOptions) error {
	if !output.IsSupportedFormat(opts.Format) {
		return fmt.Errorf("invalid output format %q (allowed: text, json)", opts.Format)
	}
	if !isSupportedTextStyle(opts.TextStyle) {
		return fmt.Errorf("invalid text style %q (allowed: auto, patch, semantic)", opts.TextStyle)
	}
	return nil
}
