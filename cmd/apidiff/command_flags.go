package main

import (
	"github.com/rea9r/apidiff/internal/output"
	"github.com/spf13/pflag"
)

type commonFlagValues struct {
	format       string
	scope        string
	view         string
	summary      string
	ignorePaths  []string
	onlyBreaking bool
	noColor      bool
}

func newCommonFlags() *commonFlagValues {
	return &commonFlagValues{
		format:  output.TextFormat,
		scope:   output.ScopeDiff,
		view:    output.ViewUnified,
		summary: output.SummaryAuto,
	}
}

func bindCommonFlags(flags *pflag.FlagSet, common *commonFlagValues) {
	flags.StringVar(&common.format, "format", output.TextFormat, "output format: text or json")
	flags.StringVar(&common.scope, "scope", output.ScopeDiff, "output scope: diff or both")
	flags.StringVar(&common.view, "view", output.ViewUnified, "text view mode: unified or semantic")
	flags.StringVar(&common.summary, "summary", output.SummaryAuto, "summary mode: auto, always, or never")
	flags.StringArrayVar(&common.ignorePaths, "ignore-path", nil, "ignore diff by exact path (can be specified multiple times)")
	flags.BoolVar(&common.onlyBreaking, "only-breaking", false, "show only breaking changes")
	flags.BoolVar(&common.noColor, "no-color", false, "disable colored text output")
}
