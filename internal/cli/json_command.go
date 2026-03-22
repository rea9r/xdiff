package cli

import "github.com/spf13/cobra"

const jsonHelpExamples = `  # Compare two local files containing JSON
  xdiff json old.json new.json

  # Ignore array order
  xdiff json --ignore-order old.json new.json

  # Emit machine-readable output
  xdiff json --output-format json old.json new.json`

func newJSONCommand(common *commonFlagValues, exitCode *int) *cobra.Command {
	jsonFlags := &jsonCompareFlagValues{}

	cmd := &cobra.Command{
		Use:     "json [flags] <old-file> <new-file>",
		Short:   "Compare two local files containing JSON",
		Example: jsonHelpExamples,
		Args:    cobra.ExactArgs(2),
		RunE:    runFileCompare(common, jsonFlags, exitCode),
	}

	bindCommonFlags(cmd.Flags(), common)
	bindJSONCompareFlags(cmd.Flags(), jsonFlags)
	return cmd
}
