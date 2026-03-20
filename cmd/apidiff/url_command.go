package main

import (
	"fmt"
	"time"

	"github.com/rea9r/apidiff/internal/app"
	"github.com/rea9r/apidiff/internal/input"
	"github.com/spf13/cobra"
)

func newURLCommand(common *commonFlagValues, exitCode *int) *cobra.Command {
	urlFlags := urlFlagValues{
		timeout: 5 * time.Second,
	}

	cmd := &cobra.Command{
		Use:   "url [flags] <old-url> <new-url>",
		Short: "Compare JSON responses from two URLs",
		Args:  cobra.ExactArgs(2),
		RunE: func(_ *cobra.Command, positionalArgs []string) error {
			oldValue, err := input.LoadJSONURL(positionalArgs[0], input.HTTPOptions{
				Headers: urlFlags.headers,
				Timeout: urlFlags.timeout,
			})
			if err != nil {
				return asRunError(2, err)
			}

			newValue, err := input.LoadJSONURL(positionalArgs[1], input.HTTPOptions{
				Headers: urlFlags.headers,
				Timeout: urlFlags.timeout,
			})
			if err != nil {
				return asRunError(2, err)
			}

			code, out, err := app.RunWithValues(oldValue, newValue, app.CompareOptions{
				Format:       common.format,
				IgnorePaths:  common.ignorePaths,
				OnlyBreaking: common.onlyBreaking,
			})
			if writeErr := writeOutput(out); writeErr != nil {
				return asRunError(2, fmt.Errorf("failed to write stdout: %w", writeErr))
			}
			if err != nil {
				return asRunError(code, err)
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
