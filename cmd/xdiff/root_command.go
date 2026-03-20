package main

import "github.com/spf13/cobra"

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
  xdiff testdata/old.json testdata/new.json

  # Plain text comparison
  xdiff text old.txt new.txt

  # URL comparison
  xdiff url https://old.example.com/api https://new.example.com/api

  # OpenAPI comparison
  xdiff spec --fail-on breaking openapi-old.yaml openapi-new.yaml

  # CI usage
  xdiff --format json --fail-on breaking testdata/old.json testdata/new.json`

func newRootCommand(exitCode *int) *cobra.Command {
	commonFlags := newCommonFlags()
	showExample := false

	root := &cobra.Command{
		Use:           "xdiff [flags] old.json new.json",
		Short:         "Compare JSON/text files, URL responses, and OpenAPI specs",
		Long:          rootHelpLong,
		Example:       rootHelpExamples,
		SilenceUsage:  true,
		SilenceErrors: true,
		Args: func(cmd *cobra.Command, args []string) error {
			if showExample {
				return cobra.NoArgs(cmd, args)
			}
			return cobra.ExactArgs(2)(cmd, args)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if showExample {
				return runExample(commonFlags, exitCode)(cmd, args)
			}
			return runFileCompare(commonFlags, exitCode)(cmd, args)
		},
	}

	bindCommonFlags(root.Flags(), commonFlags)
	root.Flags().BoolVar(&showExample, "example", false, "show a runnable quick example and expected output")
	root.AddCommand(newTextCommand(commonFlags, exitCode))
	root.AddCommand(newURLCommand(commonFlags, exitCode))
	root.AddCommand(newSpecCommand(commonFlags, exitCode))
	return root
}
