package cli

import (
	"io"

	"github.com/rea9r/xdiff/internal/output"
	"github.com/spf13/pflag"
)

type commonFlagValues struct {
	outputFormat string
	failOn       string
	ignorePaths  []string
	onlyBreaking bool
	noColor      bool
	stdout       io.Writer
}

func newCommonFlags(stdout io.Writer) *commonFlagValues {
	return &commonFlagValues{
		outputFormat: output.TextFormat,
		failOn:       "any",
		stdout:       stdout,
	}
}

func (c *commonFlagValues) useColor() bool {
	return output.ShouldUseColorOnWriter(c.noColor, c.stdout)
}

func bindCommonFlags(flags *pflag.FlagSet, common *commonFlagValues) {
	flags.StringVar(&common.outputFormat, "output-format", output.TextFormat, "output format: text or json")
	flags.StringVar(&common.failOn, "fail-on", "any", "failure mode: none, breaking, or any")
	flags.StringArrayVar(&common.ignorePaths, "ignore-path", nil, "ignore diff by exact path (can be specified multiple times)")
	flags.BoolVar(&common.onlyBreaking, "only-breaking", false, "show only breaking changes")
	flags.BoolVar(&common.noColor, "no-color", false, "disable colored text output")
}
