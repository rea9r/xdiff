package cli

import (
	"io"

	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/runner"
	"github.com/spf13/pflag"
)

type jsonCompareFlagValues struct {
	ignoreOrder bool
}

type commonFlagValues struct {
	outputFormat string
	ignorePaths  []string
	textStyle    string
	showPaths    bool
	noColor      bool
	stdout       io.Writer
}

func newCommonFlags(stdout io.Writer) *commonFlagValues {
	return &commonFlagValues{
		outputFormat: output.TextFormat,
		textStyle:    runner.TextStyleAuto,
		stdout:       stdout,
	}
}

func (c *commonFlagValues) useColor() bool {
	return output.ShouldUseColorOnWriter(c.noColor, c.stdout)
}

func (c *commonFlagValues) compareOptions() runner.CompareOptions {
	return runner.CompareOptions{
		Format:      c.outputFormat,
		IgnorePaths: append([]string(nil), c.ignorePaths...),
		TextStyle:   c.textStyle,
		ShowPaths:   c.showPaths,
		UseColor:    c.useColor(),
	}
}

func (c *commonFlagValues) fileOptions(oldPath, newPath string) runner.Options {
	return runner.Options{
		CompareOptions: c.compareOptions(),
		OldPath:        oldPath,
		NewPath:        newPath,
	}
}

func bindCommonFlags(flags *pflag.FlagSet, common *commonFlagValues) {
	flags.StringVar(&common.outputFormat, "output-format", output.TextFormat, "output format: text or json")
	flags.StringArrayVar(&common.ignorePaths, "ignore-path", nil, "ignore diff by exact path (can be specified multiple times)")
	flags.StringVar(&common.textStyle, "text-style", runner.TextStyleAuto, "text rendering style: auto, patch, semantic")
	flags.BoolVar(&common.showPaths, "show-paths", false, "print canonical diff paths only (useful with --ignore-path)")
	flags.BoolVar(&common.noColor, "no-color", false, "disable colored text output")
}

func bindJSONCompareFlags(flags *pflag.FlagSet, jsonFlags *jsonCompareFlagValues) {
	flags.BoolVar(&jsonFlags.ignoreOrder, "ignore-order", false, "treat JSON arrays as unordered when comparing")
}
