package app

import (
	"flag"
	"fmt"
	"io"
	"strings"

	"github.com/rea9r/apidiff/internal/output"
)

func parseArgs(args []string) (config, error) {
	flagArgs := normalizeLongFlags(args)

	fs := flag.NewFlagSet("apidiff", flag.ContinueOnError)
	fs.SetOutput(io.Discard)

	format := fs.String("format", output.TextFormat, "output format: text or json")
	var ignorePaths multiValueFlag
	fs.Var(&ignorePaths, "ignore-path", "ignore diff by exact path (can be specified multiple times)")
	onlyBreaking := fs.Bool("only-breaking", false, "show only breaking changes")
	if err := fs.Parse(flagArgs); err != nil {
		return config{}, fmt.Errorf("failed to parse args: %w", err)
	}

	if !output.IsSupportedFormat(*format) {
		return config{}, fmt.Errorf("invalid --format %q (allowed: text, json)", *format)
	}

	rest := fs.Args()
	if len(rest) != 2 {
		return config{}, fmt.Errorf("usage: apidiff [--format text|json] [--ignore-path path] [--only-breaking] old.json new.json")
	}

	return config{
		format:       *format,
		ignorePaths:  ignorePaths,
		onlyBreaking: *onlyBreaking,
		oldPath:      rest[0],
		newPath:      rest[1],
	}, nil
}

func normalizeLongFlags(args []string) []string {
	normalized := make([]string, 0, len(args))
	for _, arg := range args {
		switch {
		case arg == "--format":
			normalized = append(normalized, "-format")
		case strings.HasPrefix(arg, "--format="):
			normalized = append(normalized, "-format="+strings.TrimPrefix(arg, "--format="))
		case arg == "--ignore-path":
			normalized = append(normalized, "-ignore-path")
		case strings.HasPrefix(arg, "--ignore-path="):
			normalized = append(normalized, "-ignore-path="+strings.TrimPrefix(arg, "--ignore-path="))
		case arg == "--only-breaking":
			normalized = append(normalized, "-only-breaking")
		default:
			normalized = append(normalized, arg)
		}
	}
	return normalized
}

type multiValueFlag []string

func (m *multiValueFlag) String() string {
	return strings.Join(*m, ",")
}

func (m *multiValueFlag) Set(value string) error {
	*m = append(*m, value)
	return nil
}
