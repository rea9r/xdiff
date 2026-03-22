package cli

import (
	"fmt"
	"io"

	"github.com/rea9r/xdiff/internal/scenario"
	"github.com/spf13/cobra"
)

const runHelpExamples = `  # Run all checks from a scenario file
  xdiff run xdiff.yaml

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
			cfg, err := scenario.LoadFile(positionalArgs[0])
			if err != nil {
				return asRunError(2, err)
			}

			summary, results, err := scenario.Run(cfg, positionalArgs[0])
			if err != nil {
				return asRunError(2, err)
			}

			var out string
			switch runFlags.reportFormat {
			case "text":
				out = scenario.RenderText(summary, results, positionalArgs[0])
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
	return cmd
}

type runFlagValues struct {
	reportFormat string
}
