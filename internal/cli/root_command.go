package cli

import (
	"errors"
	"io"

	"github.com/rea9r/xdiff/internal/runner"
	"github.com/spf13/cobra"
)

const rootHelpLong = `Task-oriented quick guide:

JSON comparison
  Compare two local files containing JSON.

Text comparison
  Compare two local plain-text files.

Scenario mode
  Run multiple checks from one scenario file.

CI usage
  Emit JSON and fail only on breaking changes for automation.`

const rootHelpExamples = `  # Local JSON comparison
  xdiff json old.json new.json

  # Plain text comparison
  xdiff text before.txt after.txt

  # Scenario mode
  xdiff run xdiff.yaml`

func newRootCommand(exitCode *int, stdout io.Writer) *cobra.Command {
	root := &cobra.Command{
		Use:           "xdiff",
		Short:         "Compare JSON and text files",
		Long:          rootHelpLong,
		Example:       rootHelpExamples,
		SilenceUsage:  true,
		SilenceErrors: true,
		Args:          cobra.ArbitraryArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return cmd.Help()
			}
			if len(args) == 2 {
				return asRunError(2, &runner.UserHintError{
					Message: "local comparison mode must be explicit",
					Hints: []string{
						"use: xdiff json <old-file> <new-file>",
						"use: xdiff text <old-file> <new-file> for plain-text comparison",
					},
				})
			}
			return asRunError(2, errors.New("unknown command or invalid arguments"))
		},
	}

	commonFlags := newCommonFlags(stdout)
	root.AddCommand(newJSONCommand(commonFlags, exitCode))
	root.AddCommand(newTextCommand(commonFlags, exitCode))
	root.AddCommand(newRunCommand(exitCode, stdout))
	return root
}
