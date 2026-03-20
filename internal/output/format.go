package output

import (
	"fmt"

	"github.com/rea9r/apidiff/internal/diff"
)

const (
	TextFormat = "text"
	JSONFormat = "json"

	ScopeDiff = "diff"
	ScopeBoth = "both"

	ViewUnified  = "unified"
	ViewSemantic = "semantic"

	SummaryAuto   = "auto"
	SummaryAlways = "always"
	SummaryNever  = "never"
)

type Options struct {
	Format  string
	Color   bool
	Scope   string
	View    string
	Summary string
}

func Format(diffs []diff.Diff, format string) (string, error) {
	return FormatWithOptions(diffs, Options{
		Format:  format,
		Color:   false,
		Scope:   ScopeDiff,
		View:    ViewSemantic,
		Summary: SummaryAlways,
	})
}

func FormatWithOptions(diffs []diff.Diff, opts Options) (string, error) {
	scope := opts.Scope
	if scope == "" {
		scope = ScopeDiff
	}
	view := opts.View
	if view == "" {
		view = ViewSemantic
	}
	summary := opts.Summary
	if summary == "" {
		summary = SummaryAlways
	}

	switch opts.Format {
	case TextFormat:
		return RenderTextWithOptions(nil, nil, diffs, TextOptions{
			Color:   opts.Color,
			Scope:   scope,
			View:    view,
			Summary: summary,
		}), nil
	case JSONFormat:
		return RenderJSONWithOptions(nil, nil, diffs, JSONOptions{Scope: scope})
	default:
		return "", fmt.Errorf("unsupported format %q", opts.Format)
	}
}

func FormatResultWithOptions(oldValue, newValue any, diffs []diff.Diff, opts Options) (string, error) {
	scope := opts.Scope
	if scope == "" {
		scope = ScopeDiff
	}
	view := opts.View
	if view == "" {
		view = ViewSemantic
	}
	summary := opts.Summary
	if summary == "" {
		summary = SummaryAuto
	}

	switch opts.Format {
	case TextFormat:
		return RenderTextWithOptions(oldValue, newValue, diffs, TextOptions{
			Color:   opts.Color,
			Scope:   scope,
			View:    view,
			Summary: summary,
		}), nil
	case JSONFormat:
		return RenderJSONWithOptions(oldValue, newValue, diffs, JSONOptions{Scope: scope})
	default:
		return "", fmt.Errorf("unsupported format %q", opts.Format)
	}
}

func IsSupportedFormat(format string) bool {
	return format == TextFormat || format == JSONFormat
}

func IsSupportedScope(scope string) bool {
	return scope == ScopeDiff || scope == ScopeBoth
}

func IsSupportedView(view string) bool {
	return view == ViewUnified || view == ViewSemantic
}

func IsSupportedSummary(summary string) bool {
	return summary == SummaryAuto || summary == SummaryAlways || summary == SummaryNever
}
