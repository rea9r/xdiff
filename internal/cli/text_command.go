package cli

import (
	"github.com/rea9r/xdiff/internal/runner"
	"github.com/spf13/cobra"
)

const textHelpExamples = `  # Compare two local text files
  xdiff text before.txt after.txt

  # Emit machine-readable output
  xdiff text --output-format json before.txt after.txt`

func newTextCommand(common *commonFlagValues, exitCode *int) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "text [flags] old.txt new.txt",
		Short:   "Compare plain text files",
		Example: textHelpExamples,
		Args:    cobra.ExactArgs(2),
		RunE: func(_ *cobra.Command, positionalArgs []string) error {
			code, out, err := runner.RunTextFiles(common.fileOptions(positionalArgs[0], positionalArgs[1]))
			if err := writeRunnerResult(common.stdout, code, out, err); err != nil {
				return err
			}

			*exitCode = code
			return nil
		},
	}

	bindCommonFlags(cmd.Flags(), common)
	return cmd
}
