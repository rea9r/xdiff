package main

import (
	"errors"
	"fmt"
	"time"

	"github.com/rea9r/apidiff/internal/app"
	"github.com/rea9r/apidiff/internal/input"
	"github.com/rea9r/apidiff/internal/output"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

func runCLI(args []string) (int, error) {
	exitCode := 0
	commonFlags := newCommonFlags()

	root := &cobra.Command{
		Use:           "apidiff [flags] old.json new.json",
		Short:         "Compare API responses (JSON files or URLs)",
		SilenceUsage:  true,
		SilenceErrors: true,
		Args:          cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, positionalArgs []string) error {
			opts := app.Options{
				Format:       output.TextFormat,
				IgnorePaths:  append([]string(nil), commonFlags.ignorePaths...),
				OnlyBreaking: commonFlags.onlyBreaking,
				OldPath:      positionalArgs[0],
				NewPath:      positionalArgs[1],
			}

			code, out, err := app.RunWithOptions(opts)
			if writeErr := writeOutput(out); writeErr != nil {
				return asRunError(2, fmt.Errorf("failed to write stdout: %w", writeErr))
			}
			if err != nil {
				return asRunError(code, err)
			}
			exitCode = code
			return nil
		},
	}

	bindCommonFlags(root.Flags(), &commonFlags)

	root.AddCommand(newURLCommand(&commonFlags, &exitCode))

	root.SetArgs(args)
	if err := root.Execute(); err != nil {
		var rerr *runError
		if errors.As(err, &rerr) {
			return rerr.code, rerr.err
		}
		return 2, err
	}

	return exitCode, nil
}

func newURLCommand(common *commonFlagValues, exitCode *int) *cobra.Command {
	urlFlags := urlFlagValues{
		timeout: 5 * time.Second,
	}

	cmd := &cobra.Command{
		Use:   "url [flags] <old-url> <new-url>",
		Short: "Compare JSON responses from two URLs",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, positionalArgs []string) error {
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

func writeOutput(out string) error {
	if out == "" {
		return nil
	}
	return writeStdout(out)
}

func asRunError(code int, err error) *runError {
	return &runError{
		code: code,
		err:  err,
	}
}

type commonFlagValues struct {
	format       string
	ignorePaths  []string
	onlyBreaking bool
}

func newCommonFlags() commonFlagValues {
	return commonFlagValues{
		format: output.TextFormat,
	}
}

func bindCommonFlags(flags *pflag.FlagSet, common *commonFlagValues) {
	flags.StringVar(&common.format, "format", output.TextFormat, "output format: text or json")
	flags.StringArrayVar(&common.ignorePaths, "ignore-path", nil, "ignore diff by exact path (can be specified multiple times)")
	flags.BoolVar(&common.onlyBreaking, "only-breaking", false, "show only breaking changes")
}

type urlFlagValues struct {
	headers []string
	timeout time.Duration
}

type runError struct {
	code int
	err  error
}

func (e *runError) Error() string {
	return e.err.Error()
}

func (e *runError) Unwrap() error {
	return e.err
}
