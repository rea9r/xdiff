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
	oldValue, err := oldLoader()
	if err != nil {
		return exitError, "", err
	}

	newValue, err := newLoader()
	if err != nil {
		return exitError, "", err
	}

	return RunJSONValues(oldValue, newValue, opts)
}

func RunJSONValues(oldValue, newValue any, opts CompareOptions) (int, string, error) {
	if err := validateCompareOptions(opts); err != nil {
		return exitError, "", err
	}

	diffs := jsondiff.Compare(oldValue, newValue)
	diffs = delta.ApplyOptions(diffs, delta.Options{
		IgnorePaths:  opts.IgnorePaths,
		OnlyBreaking: opts.OnlyBreaking,
	})

	var out string
	switch opts.Format {
	case output.TextFormat:
		out = output.RenderUnifiedJSONWithColor(oldValue, newValue, output.ShouldUseColor(opts.NoColor))
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
		out = output.RenderSemanticTextWithColor(filtered, output.ShouldUseColor(opts.NoColor))
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
	return nil
}
