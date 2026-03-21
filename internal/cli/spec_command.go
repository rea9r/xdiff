package cli

import (
	"fmt"

	"github.com/rea9r/xdiff/internal/openapi"
	"github.com/rea9r/xdiff/internal/runner"
	"github.com/rea9r/xdiff/internal/source"
	"github.com/spf13/cobra"
)

func newSpecCommand(common *commonFlagValues, exitCode *int) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "spec [flags] <old-spec> <new-spec>",
		Short: "Compare OpenAPI specs by paths and methods",
		Args:  cobra.ExactArgs(2),
		RunE: func(_ *cobra.Command, positionalArgs []string) error {
			oldSpec, err := source.LoadOpenAPISpecFile(positionalArgs[0])
			if err != nil {
				return asRunError(2, err)
			}
			newSpec, err := source.LoadOpenAPISpecFile(positionalArgs[1])
			if err != nil {
				return asRunError(2, err)
			}

			diffs := openapi.LabelDiffPaths(openapi.ComparePathsMethods(oldSpec, newSpec))
			code, out, err := runner.RunDeltaDiffs(diffs, runner.CompareOptions{
				Format:       common.outputFormat,
				FailOn:       common.failOn,
				IgnorePaths:  append([]string(nil), common.ignorePaths...),
				OnlyBreaking: common.onlyBreaking,
				UseColor:     common.useColor(),
			})
			if writeErr := writeOutput(common.stdout, out); writeErr != nil {
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
