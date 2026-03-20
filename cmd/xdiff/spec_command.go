package main

import (
	"fmt"

	"github.com/rea9r/xdiff/internal/app"
	"github.com/rea9r/xdiff/internal/input"
	"github.com/rea9r/xdiff/internal/spec"
	"github.com/spf13/cobra"
)

func newSpecCommand(common *commonFlagValues, exitCode *int) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "spec [flags] <old-spec> <new-spec>",
		Short: "Compare OpenAPI specs by paths and methods",
		Args:  cobra.ExactArgs(2),
		RunE: func(_ *cobra.Command, positionalArgs []string) error {
			oldSpec, err := input.LoadOpenAPISpecFile(positionalArgs[0])
			if err != nil {
				return asRunError(2, err)
			}
			newSpec, err := input.LoadOpenAPISpecFile(positionalArgs[1])
			if err != nil {
				return asRunError(2, err)
			}

			diffs := spec.ComparePathsMethods(oldSpec, newSpec)
			code, out, err := app.RunWithDiffs(diffs, app.CompareOptions{
				Format:       common.format,
				FailOn:       common.failOn,
				IgnorePaths:  append([]string(nil), common.ignorePaths...),
				OnlyBreaking: common.onlyBreaking,
				NoColor:      common.noColor,
			})
			if writeErr := writeOutput(out); writeErr != nil {
				return asRunError(2, fmt.Errorf("failed to write stdout: %w", writeErr))
			}
			if err != nil {
				return asRunError(code, err)
			}

			*exitCode = code
			return nil
		},
	}

	bindCommonFlags(cmd.Flags(), common)
	return cmd
}
