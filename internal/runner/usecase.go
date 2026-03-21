package runner

import (
	"context"
	"errors"
	"fmt"

	"github.com/rea9r/xdiff/internal/delta"
	"github.com/rea9r/xdiff/internal/jsondiff"
	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/source"
)

type ValueLoader func(context.Context) (any, error)

type loadResult struct {
	value any
	err   error
}

func RunJSONFiles(opts Options) (int, string, error) {
	if err := validateFileOptions(opts); err != nil {
		return exitError, "", err
	}

	return RunJSONLoaders(
		func(_ context.Context) (any, error) {
			return source.LoadJSONFile(opts.OldPath)
		},
		func(_ context.Context) (any, error) {
			return source.LoadJSONFile(opts.NewPath)
		},
		opts.CompareOptions(),
	)
}

func RunJSONLoaders(oldLoader, newLoader ValueLoader, opts CompareOptions) (int, string, error) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	oldCh := make(chan loadResult, 1)
	newCh := make(chan loadResult, 1)

	go func() {
		v, err := oldLoader(ctx)
		oldCh <- loadResult{value: v, err: err}
	}()

	go func() {
		v, err := newLoader(ctx)
		newCh <- loadResult{value: v, err: err}
	}()

	var (
		oldRes loadResult
		newRes loadResult
		gotOld bool
		gotNew bool
	)

	for !gotOld || !gotNew {
		select {
		case res := <-oldCh:
			oldRes = res
			gotOld = true
			if oldRes.err != nil {
				cancel()
				return exitError, "", oldRes.err
			}
			if gotNew && newRes.err != nil {
				return exitError, "", newRes.err
			}
		case res := <-newCh:
			newRes = res
			gotNew = true
			if gotOld {
				if oldRes.err != nil {
					cancel()
					return exitError, "", oldRes.err
				}
				if newRes.err != nil {
					return exitError, "", newRes.err
				}
			}
		}
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
		return newUserHintError(
			fmt.Sprintf("invalid output format %q", opts.Format),
			"allowed values: text, json",
			"try --output-format text",
		)
	}
	if opts.FailOn != "" && !IsSupportedFailOn(opts.FailOn) {
		return newUserHintError(
			fmt.Sprintf("invalid fail-on mode %q", opts.FailOn),
			"allowed values: none, breaking, any",
			"try --fail-on any",
		)
	}
	if !isSupportedTextStyle(opts.TextStyle) {
		return newUserHintError(
			fmt.Sprintf("invalid text style %q", opts.TextStyle),
			"allowed values: auto, patch, semantic",
			"try --text-style auto",
		)
	}
	return nil
}
