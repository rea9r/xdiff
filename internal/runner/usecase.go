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
	return RunJSONFilesDetailed(opts).Triple()
}

func RunJSONFilesDetailed(opts Options) RunResult {
	if err := validateFileOptions(opts); err != nil {
		return finalizeRun(nil, "", err, opts.FailOn)
	}

	return RunJSONLoadersDetailed(
		func(_ context.Context) (any, error) {
			return source.LoadJSONFile(opts.OldPath)
		},
		func(_ context.Context) (any, error) {
			return source.LoadJSONFile(opts.NewPath)
		},
		opts.CompareOptions,
	)
}

func RunJSONLoaders(oldLoader, newLoader ValueLoader, opts CompareOptions) (int, string, error) {
	return RunJSONLoadersDetailed(oldLoader, newLoader, opts).Triple()
}

func RunJSONLoadersDetailed(oldLoader, newLoader ValueLoader, opts CompareOptions) RunResult {
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
				return finalizeRun(nil, "", oldRes.err, opts.FailOn)
			}
			if gotNew && newRes.err != nil {
				return finalizeRun(nil, "", newRes.err, opts.FailOn)
			}
		case res := <-newCh:
			newRes = res
			gotNew = true
			if gotOld {
				if oldRes.err != nil {
					cancel()
					return finalizeRun(nil, "", oldRes.err, opts.FailOn)
				}
				if newRes.err != nil {
					return finalizeRun(nil, "", newRes.err, opts.FailOn)
				}
			}
		}
	}

	return RunJSONValuesDetailed(oldRes.value, newRes.value, opts)
}

func RunJSONValues(oldValue, newValue any, opts CompareOptions) (int, string, error) {
	return RunJSONValuesDetailed(oldValue, newValue, opts).Triple()
}

func RunJSONValuesDetailed(oldValue, newValue any, opts CompareOptions) RunResult {
	if err := validateCompareOptions(opts); err != nil {
		return finalizeRun(nil, "", err, opts.FailOn)
	}

	diffs, err := jsondiff.CompareWithOptions(oldValue, newValue, jsondiff.Options{
		IgnoreOrder: opts.IgnoreOrder,
	})
	if err != nil {
		return finalizeRun(nil, "", err, opts.FailOn)
	}
	diffs = delta.ApplyOptions(diffs, delta.Options{
		IgnorePaths:  opts.IgnorePaths,
		OnlyBreaking: opts.OnlyBreaking,
	})

	var out string
	switch {
	case opts.ShowPaths:
		out = output.RenderPaths(diffs)
	case opts.Format == output.TextFormat:
		style, err := resolveJSONTextStyle(opts)
		if err != nil {
			return finalizeRun(diffs, "", err, opts.FailOn)
		}

		if len(diffs) == 0 {
			out = "No differences.\n"
			break
		}
		if style == TextStyleSemantic {
			out = output.RenderSemanticText(diffs, output.SemanticTextOptions{
				UseColor: opts.UseColor,
			})
			break
		}
		out = output.RenderUnifiedJSONWithColor(oldValue, newValue, opts.UseColor)
	case opts.Format == output.JSONFormat:
		rendered, err := output.RenderJSON(diffs)
		if err != nil {
			return finalizeRun(diffs, "", err, opts.FailOn)
		}
		out = rendered
	}

	return finalizeRun(diffs, out, nil, opts.FailOn)
}

func validateFileOptions(opts Options) error {
	if opts.OldPath == "" || opts.NewPath == "" {
		return errors.New("old and new file paths are required")
	}
	return validateCompareOptions(opts.CompareOptions)
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
