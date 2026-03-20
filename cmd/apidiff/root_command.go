package main

import (
	"fmt"

	"github.com/rea9r/apidiff/internal/app"
	"github.com/spf13/cobra"
)

func newRootCommand(exitCode *int) *cobra.Command {
	commonFlags := newCommonFlags()

	root := &cobra.Command{
		Use:           "apidiff [flags] old.json new.json",
		Short:         "Compare API responses (JSON files or URLs)",
		SilenceUsage:  true,
		SilenceErrors: true,
		Args:          cobra.ExactArgs(2),
		RunE:          runFileCompare(commonFlags, exitCode),
	}

	bindCommonFlags(root.Flags(), commonFlags)
	root.AddCommand(newURLCommand(commonFlags, exitCode))
	return root
}

func runFileCompare(common *commonFlagValues, exitCode *int) func(*cobra.Command, []string) error {
	return func(_ *cobra.Command, positionalArgs []string) error {
		opts := app.Options{
			Format:       common.format,
			IgnorePaths:  append([]string(nil), common.ignorePaths...),
			OnlyBreaking: common.onlyBreaking,
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
