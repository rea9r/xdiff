package cli

import (
	"github.com/rea9r/xdiff/internal/output"
	"github.com/spf13/pflag"
)

type commonFlagValues struct {
	outputFormat string
	failOn       string
	ignorePaths  []string
	onlyBreaking bool
	noColor      bool
}

func newCommonFlags() *commonFlagValues {
	return &commonFlagValues{
		outputFormat: output.TextFormat,
		failOn:       "any",
	}
}

func bindCommonFlags(flags *pflag.FlagSet, common *commonFlagValues) {
	flags.StringVar(&common.outputFormat, "output-format", output.TextFormat, "output format: text or json")
	flags.StringVar(&common.failOn, "fail-on", "any", "failure mode: none, breaking, or any")
	flags.StringArrayVar(&common.ignorePaths, "ignore-path", nil, "ignore diff by exact path (can be specified multiple times)")
	flags.BoolVar(&common.onlyBreaking, "only-breaking", false, "show only breaking changes")
	flags.BoolVar(&common.noColor, "no-color", false, "disable colored text output")
}
