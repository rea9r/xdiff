package cli

import (
	"fmt"

	"github.com/rea9r/xdiff/internal/runner"
	"github.com/spf13/cobra"
)

func newTextCommand(common *commonFlagValues, exitCode *int) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "text [flags] <old-text-file> <new-text-file>",
		Short: "Compare plain text files",
		Args:  cobra.ExactArgs(2),
		RunE: func(_ *cobra.Command, positionalArgs []string) error {
			code, out, err := runner.RunTextFiles(runner.Options{
				Format:       common.outputFormat,
				FailOn:       common.failOn,
				IgnorePaths:  append([]string(nil), common.ignorePaths...),
				OnlyBreaking: common.onlyBreaking,
				UseColor:     common.useColor(),
				OldPath:      positionalArgs[0],
				NewPath:      positionalArgs[1],
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
