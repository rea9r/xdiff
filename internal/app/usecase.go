package app

import (
	"errors"
	"fmt"

	"github.com/rea9r/apidiff/internal/diff"
	"github.com/rea9r/apidiff/internal/input"
	"github.com/rea9r/apidiff/internal/output"
)

func RunWithOptions(opts Options) (int, string, error) {
	if err := validateFileOptions(opts); err != nil {
		return exitError, "", err
	}

	oldValue, err := input.LoadJSONFile(opts.OldPath)
	if err != nil {
		return exitError, "", err
	}

	newValue, err := input.LoadJSONFile(opts.NewPath)
	if err != nil {
		return exitError, "", err
	}

	return RunWithValues(oldValue, newValue, opts.CompareOptions())
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
		Format:  opts.Format,
		Color:   output.ShouldUseColor(opts.NoColor),
		Scope:   opts.Scope,
		View:    opts.View,
		Summary: opts.Summary,
	})
	if err != nil {
		return exitError, "", err
	}

	if len(diffs) > 0 {
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
	if opts.Scope != "" && !output.IsSupportedScope(opts.Scope) {
		return fmt.Errorf("invalid scope %q (allowed: diff, both)", opts.Scope)
	}
	if opts.View != "" && !output.IsSupportedView(opts.View) {
		return fmt.Errorf("invalid view mode %q (allowed: unified, semantic)", opts.View)
	}
	if opts.Summary != "" && !output.IsSupportedSummary(opts.Summary) {
		return fmt.Errorf("invalid summary mode %q (allowed: auto, always, never)", opts.Summary)
	}
	return nil
}
