package main

import "github.com/spf13/cobra"

func newRootCommand(exitCode *int) *cobra.Command {
	commonFlags := newCommonFlags()

	root := &cobra.Command{
		Use:           "xdiff [flags] old.json new.json",
		Short:         "Compare API responses (JSON files/URLs) and OpenAPI specs",
		SilenceUsage:  true,
		SilenceErrors: true,
		Args:          cobra.ExactArgs(2),
		RunE:          runFileCompare(commonFlags, exitCode),
	}

	bindCommonFlags(root.Flags(), commonFlags)
	root.AddCommand(newURLCommand(commonFlags, exitCode))
	root.AddCommand(newSpecCommand(commonFlags, exitCode))
	return root
}
