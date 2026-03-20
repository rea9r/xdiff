package app

import (
	"errors"
	"fmt"

	"github.com/rea9r/xdiff/internal/diff"
	"github.com/rea9r/xdiff/internal/input"
	"github.com/rea9r/xdiff/internal/output"
)

type ValueLoader func() (any, error)

func RunWithOptions(opts Options) (int, string, error) {
	if err := validateFileOptions(opts); err != nil {
		return exitError, "", err
	}

	return RunWithValueLoaders(
		func() (any, error) {
			return input.LoadJSONFile(opts.OldPath)
		},
		func() (any, error) {
			return input.LoadJSONFile(opts.NewPath)
		},
		opts.CompareOptions(),
	)
}

func RunWithValueLoaders(oldLoader, newLoader ValueLoader, opts CompareOptions) (int, string, error) {
	oldValue, err := oldLoader()
	if err != nil {
		return exitError, "", err
	}

	newValue, err := newLoader()
	if err != nil {
		return exitError, "", err
	}

	return RunWithValues(oldValue, newValue, opts)
}

func RunWithValues(oldValue, newValue any, opts CompareOptions) (int, string, error) {
	if err := validateCompareOptions(opts); err != nil {
		return exitError, "", err
	}

	diffs := diff.Compare(oldValue, newValue)
	diffs = diff.ApplyOptions(diffs, diff.Options{
		IgnorePaths:  opts.IgnorePaths,
		OnlyBreaking: opts.OnlyBreaking,
	})

	out, err := output.FormatResultWithOptions(oldValue, newValue, diffs, output.Options{
		Format: opts.Format,
		Color:  output.ShouldUseColor(opts.NoColor),
	})
	if err != nil {
		return exitError, "", err
	}

	hasFailure := HasFailureByMode(diffs, opts.FailOn)
	out = decorateTextResult(opts.Format, opts.FailOn, hasFailure, diffs, out)
	if hasFailure {
		return exitDiffFound, out, nil
	}
	return exitOK, out, nil
}

func RunWithDiffs(diffs []diff.Diff, opts CompareOptions) (int, string, error) {
	if err := validateCompareOptions(opts); err != nil {
		return exitError, "", err
	}

	filtered := diff.ApplyOptions(diffs, diff.Options{
		IgnorePaths:  opts.IgnorePaths,
		OnlyBreaking: opts.OnlyBreaking,
	})

	out, err := output.FormatWithOptions(filtered, output.Options{
		Format: opts.Format,
		Color:  output.ShouldUseColor(opts.NoColor),
	})
	if err != nil {
		return exitError, "", err
	}

	hasFailure := HasFailureByMode(filtered, opts.FailOn)
	out = decorateTextResult(opts.Format, opts.FailOn, hasFailure, filtered, out)
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
		return fmt.Errorf("invalid format %q (allowed: text, json)", opts.Format)
	}
	if opts.FailOn != "" && !IsSupportedFailOn(opts.FailOn) {
		return fmt.Errorf("invalid fail-on mode %q (allowed: none, breaking, any)", opts.FailOn)
	}
	return nil
}
