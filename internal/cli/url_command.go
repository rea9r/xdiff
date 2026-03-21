package cli

import (
	"time"

	"github.com/rea9r/xdiff/internal/runner"
	"github.com/rea9r/xdiff/internal/source"
	"github.com/spf13/cobra"
)

const urlHelpExamples = `  # Compare two JSON endpoints
  xdiff url https://old.example.com/api https://new.example.com/api

  # Compare with auth header and timeout
  xdiff url --timeout 3s --header "Authorization: Bearer xxx" https://old.example.com/api https://new.example.com/api`

func newURLCommand(common *commonFlagValues, exitCode *int) *cobra.Command {
	urlFlags := urlFlagValues{
		timeout: 5 * time.Second,
	}

	cmd := &cobra.Command{
		Use:     "url [flags] <old-url> <new-url>",
		Short:   "Compare JSON responses from two URLs",
		Example: urlHelpExamples,
		Args:    cobra.ExactArgs(2),
		RunE: func(_ *cobra.Command, positionalArgs []string) error {
			load := func(rawURL string) runner.ValueLoader {
				return func() (any, error) {
					return source.LoadJSONURL(rawURL, source.HTTPOptions{
						Headers: urlFlags.headers,
						Timeout: urlFlags.timeout,
					})
				}
			}

			code, out, err := runner.RunJSONLoaders(
				load(positionalArgs[0]),
				load(positionalArgs[1]),
				common.compareOptions(),
			)
			if err := writeRunnerResult(common.stdout, code, out, err); err != nil {
				return err
			}

			*exitCode = code
			return nil
		},
	}

	bindCommonFlags(cmd.Flags(), common)
	cmd.Flags().StringArrayVar(&urlFlags.headers, "header", nil, "HTTP header (can be specified multiple times, e.g. \"Authorization: Bearer xxx\")")
	cmd.Flags().DurationVar(&urlFlags.timeout, "timeout", 5*time.Second, "request timeout (e.g. 3s, 1m)")
	return cmd
}

type urlFlagValues struct {
	headers []string
	timeout time.Duration
}
