package runner

import (
	"errors"
	"fmt"

	"github.com/rea9r/xdiff/internal/delta"
	"github.com/rea9r/xdiff/internal/jsondiff"
	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/source"
)

type ValueLoader func() (any, error)

type loadResult struct {
	value any
	err   error
}

func RunJSONFiles(opts Options) (int, string, error) {
	if err := validateFileOptions(opts); err != nil {
		return exitError, "", err
	}

	return RunJSONLoaders(
		func() (any, error) {
			return source.LoadJSONFile(opts.OldPath)
		},
		func() (any, error) {
			return source.LoadJSONFile(opts.NewPath)
		},
		opts.CompareOptions(),
	)
}

func RunJSONLoaders(oldLoader, newLoader ValueLoader, opts CompareOptions) (int, string, error) {
	oldCh := make(chan loadResult, 1)
	newCh := make(chan loadResult, 1)

	go func() {
		v, err := oldLoader()
		oldCh <- loadResult{value: v, err: err}
	}()

	go func() {
		v, err := newLoader()
		newCh <- loadResult{value: v, err: err}
	}()

	oldRes := <-oldCh
	newRes := <-newCh

	if oldRes.err != nil {
		return exitError, "", oldRes.err
	}
	if newRes.err != nil {
		return exitError, "", newRes.err
	}

	return RunJSONValues(oldRes.value, newRes.value, opts)
}

func RunJSONValues(oldValue, newValue any, opts CompareOptions) (int, string, error) {
	if err := validateCompareOptions(opts); err != nil {
		return exitError, "", err
	}

	diffs := jsondiff.CompareWithOptions(oldValue, newValue, jsondiff.Options{
		IgnoreOrder: opts.IgnoreOrder,
	})
	diffs = delta.ApplyOptions(diffs, delta.Options{
		IgnorePaths:  opts.IgnorePaths,
		OnlyBreaking: opts.OnlyBreaking,
	})

	var out string
	switch opts.Format {
	case output.TextFormat:
		style, err := resolveJSONTextStyle(opts)
		if err != nil {
			return exitError, "", err
		}

		if len(diffs) == 0 {
			out = "No differences.\n"
			break
		}
		if style == TextStyleSemantic {
			out = output.RenderSemanticText(diffs, output.SemanticTextOptions{
				UseColor:      opts.UseColor,
				PathFormatter: opts.PathFormatter,
			})
			break
		}
		out = output.RenderUnifiedJSONWithColor(oldValue, newValue, opts.UseColor)
	case output.JSONFormat:
		rendered, err := output.RenderJSON(diffs)
		if err != nil {
			return exitError, "", err
		}
		out = rendered
	}

	hasFailure := HasFailureByMode(diffs, opts.FailOn)
	if hasFailure {
		return exitDiffFound, out, nil
	}
	return exitOK, out, nil
}

func RunDeltaDiffs(diffs []delta.Diff, opts CompareOptions) (int, string, error) {
	if err := validateCompareOptions(opts); err != nil {
		return exitError, "", err
	}

	filtered := delta.ApplyOptions(diffs, delta.Options{
		IgnorePaths:  opts.IgnorePaths,
		OnlyBreaking: opts.OnlyBreaking,
	})

	var out string
	switch opts.Format {
	case output.TextFormat:
		if _, err := resolveDeltaTextStyle(opts); err != nil {
			return exitError, "", err
		}
		out = output.RenderSemanticText(filtered, output.SemanticTextOptions{
			UseColor:      opts.UseColor,
			PathFormatter: opts.PathFormatter,
		})
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

func validateFileOptions(opts Options) error {
	if opts.OldPath == "" || opts.NewPath == "" {
		return errors.New("old and new file paths are required")
	}
	return validateCompareOptions(opts.CompareOptions())
}

func validateCompareOptions(opts CompareOptions) error {
	if !output.IsSupportedFormat(opts.Format) {
		return fmt.Errorf("invalid output format %q (allowed: text, json)", opts.Format)
	}
	if opts.FailOn != "" && !IsSupportedFailOn(opts.FailOn) {
		return fmt.Errorf("invalid fail-on mode %q (allowed: none, breaking, any)", opts.FailOn)
	}
	if !isSupportedTextStyle(opts.TextStyle) {
		return fmt.Errorf("invalid text style %q (allowed: auto, patch, semantic)", opts.TextStyle)
	}
	return nil
}
