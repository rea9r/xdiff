package cli

import (
	"fmt"
	"io"

	"github.com/rea9r/xdiff/internal/scenario"
	"github.com/spf13/cobra"
)

const runHelpExamples = `  # Run all checks from a scenario file
  xdiff run xdiff.yaml

  # List checks without executing them
  xdiff run --list xdiff.yaml

  # Run only selected checks
  xdiff run --only local-user-json --only public-contract xdiff.yaml

  # Emit machine-readable scenario report
  xdiff run --report-format json xdiff.yaml`

func newRunCommand(exitCode *int, stdout io.Writer) *cobra.Command {
	runFlags := &runFlagValues{reportFormat: "text"}

	cmd := &cobra.Command{
		Use:     "run [flags] <scenario-file>",
		Short:   "Run multiple checks from a scenario file",
		Example: runHelpExamples,
		Args:    cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, positionalArgs []string) error {
			scenarioPath := positionalArgs[0]

			cfg, err := scenario.LoadFile(scenarioPath)
			if err != nil {
				return asRunError(2, err)
			}

			checks, err := scenario.Resolve(cfg, scenarioPath)
			if err != nil {
				return asRunError(2, err)
			}

			checks, err = scenario.FilterResolvedChecks(checks, runFlags.only)
			if err != nil {
				return asRunError(2, err)
			}

			if runFlags.list {
				var out string
				switch runFlags.reportFormat {
				case "text":
					out = scenario.RenderCheckListText(checks, scenarioPath)
				case "json":
					rendered, err := scenario.RenderCheckListJSON(checks)
					if err != nil {
						return asRunError(2, err)
					}
					out = rendered
				default:
					return asRunError(2, fmt.Errorf("invalid report format %q (allowed: text, json)", runFlags.reportFormat))
				}

				if err := writeOutput(stdout, out); err != nil {
					return asRunError(2, fmt.Errorf("failed to write stdout: %w", err))
				}

				*exitCode = 0
				return nil
			}

			summary, results := scenario.RunResolved(checks)

			var out string
			switch runFlags.reportFormat {
			case "text":
				out = scenario.RenderText(summary, results, scenarioPath)
			case "json":
				rendered, err := scenario.RenderJSON(summary, results)
				if err != nil {
					return asRunError(2, err)
				}
				out = rendered
			default:
				return asRunError(2, fmt.Errorf("invalid report format %q (allowed: text, json)", runFlags.reportFormat))
			}

			if err := writeOutput(stdout, out); err != nil {
				return asRunError(2, fmt.Errorf("failed to write stdout: %w", err))
			}

			*exitCode = summary.ExitCode
			return nil
		},
	}

	cmd.Flags().StringVar(&runFlags.reportFormat, "report-format", "text", "scenario report format: text or json")
	cmd.Flags().BoolVar(&runFlags.list, "list", false, "list checks without executing them")
	cmd.Flags().StringArrayVar(&runFlags.only, "only", nil, "run only the named check (repeatable)")
	return cmd
}

type runFlagValues struct {
	reportFormat string
	list         bool
	only         []string
}
