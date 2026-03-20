package main

import (
	"fmt"

	"github.com/rea9r/apidiff/internal/app"
	"github.com/spf13/cobra"
)

func runFileCompare(common *commonFlagValues, exitCode *int) func(*cobra.Command, []string) error {
	return func(_ *cobra.Command, positionalArgs []string) error {
		opts := app.Options{
			Format:       common.format,
			Scope:        common.scope,
			View:         common.view,
			Summary:      common.summary,
			IgnorePaths:  append([]string(nil), common.ignorePaths...),
			OnlyBreaking: common.onlyBreaking,
			NoColor:      common.noColor,
			OldPath:      positionalArgs[0],
			NewPath:      positionalArgs[1],
		}

		code, out, err := app.RunWithOptions(opts)
		if writeErr := writeOutput(out); writeErr != nil {
			return asRunError(2, fmt.Errorf("failed to write stdout: %w", writeErr))
		}
		if err != nil {
			return asRunError(code, err)
		}

		*exitCode = code
		return nil
	}
}
