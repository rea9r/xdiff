package cli

import (
	"fmt"

	"github.com/rea9r/xdiff/internal/runner"
	"github.com/spf13/cobra"
)

func runFileCompare(common *commonFlagValues, exitCode *int) func(*cobra.Command, []string) error {
	return func(_ *cobra.Command, positionalArgs []string) error {
		opts := runner.Options{
			Format:       common.outputFormat,
			FailOn:       common.failOn,
			IgnorePaths:  append([]string(nil), common.ignorePaths...),
			OnlyBreaking: common.onlyBreaking,
			UseColor:     common.useColor(),
			OldPath:      positionalArgs[0],
			NewPath:      positionalArgs[1],
		}

		code, out, err := runner.RunJSONFiles(opts)
		if writeErr := writeOutput(common.stdout, out); writeErr != nil {
			return asRunError(2, fmt.Errorf("failed to write stdout: %w", writeErr))
		}
		if err != nil {
			return asRunError(code, err)
		}

		*exitCode = code
		return nil
	}
}
