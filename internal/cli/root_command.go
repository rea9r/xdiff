package cli

import (
	"io"

	"github.com/spf13/cobra"
)

const rootHelpLong = `Task-oriented quick guide:

Local comparison
  Compare two local files and review differences quickly.

URL comparison
  Compare runtime responses from two endpoints.

OpenAPI comparison
  Compare contract-level changes between two OpenAPI specs.

CI usage
  Emit JSON and fail only on breaking changes for automation.`

const rootHelpExamples = `  # Local comparison (quickest)
  xdiff old.json new.json

  # Plain text comparison
  xdiff text before.txt after.txt

  # URL comparison
  xdiff url https://old.example.com/api https://new.example.com/api

  # OpenAPI comparison
  xdiff spec --fail-on breaking old-openapi.yaml new-openapi.yaml

  # CI usage
  xdiff --output-format json --fail-on breaking old.json new.json`

func newRootCommand(exitCode *int, stdout io.Writer) *cobra.Command {
	commonFlags := newCommonFlags(stdout)

	root := &cobra.Command{
		Use:           "xdiff [flags] old.json new.json",
		Short:         "Compare JSON/text files, URL responses, and OpenAPI specs",
		Long:          rootHelpLong,
		Example:       rootHelpExamples,
		SilenceUsage:  true,
		SilenceErrors: true,
		Args:          cobra.ExactArgs(2),
		RunE:          runFileCompare(commonFlags, exitCode),
	}

	bindCommonFlags(root.Flags(), commonFlags)
	root.AddCommand(newTextCommand(commonFlags, exitCode))
	root.AddCommand(newURLCommand(commonFlags, exitCode))
	root.AddCommand(newSpecCommand(commonFlags, exitCode))
	return root
}
