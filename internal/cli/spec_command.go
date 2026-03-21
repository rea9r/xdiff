package cli

import (
	"github.com/rea9r/xdiff/internal/openapi"
	"github.com/rea9r/xdiff/internal/runner"
	"github.com/rea9r/xdiff/internal/source"
	"github.com/spf13/cobra"
)

const specHelpExamples = `  # Compare two OpenAPI specs
  xdiff spec old-openapi.yaml new-openapi.yaml

  # Fail only on breaking changes
  xdiff spec --fail-on breaking old-openapi.yaml new-openapi.yaml`

func newSpecCommand(common *commonFlagValues, exitCode *int) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "spec [flags] <old-spec> <new-spec>",
		Short:   "Compare OpenAPI specs by paths and methods",
		Example: specHelpExamples,
		Args:    cobra.ExactArgs(2),
		RunE: func(_ *cobra.Command, positionalArgs []string) error {
			oldSpec, err := source.LoadOpenAPISpecFile(positionalArgs[0])
			if err != nil {
				return asRunError(2, err)
			}
			newSpec, err := source.LoadOpenAPISpecFile(positionalArgs[1])
			if err != nil {
				return asRunError(2, err)
			}

			diffs := openapi.ComparePathsMethods(oldSpec, newSpec)
			opts := common.compareOptions()
			opts.PathFormatter = openapi.HumanizePath

			code, out, err := runner.RunDeltaDiffs(diffs, opts)
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
