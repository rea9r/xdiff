package runner

import "fmt"

func isSupportedTextStyle(style string) bool {
	switch style {
	case "", TextStyleAuto, TextStylePatch, TextStyleSemantic:
		return true
	default:
		return false
	}
}

func resolveJSONTextStyle(opts CompareOptions) (string, error) {
	switch opts.TextStyle {
	case "", TextStyleAuto:
		if len(opts.IgnorePaths) > 0 || opts.IgnoreOrder {
			return TextStyleSemantic, nil
		}
		return TextStylePatch, nil
	case TextStylePatch:
		if len(opts.IgnorePaths) > 0 || opts.IgnoreOrder {
			return "", newUserHintError(
				fmt.Sprintf("text style %q cannot be used with --ignore-path or --ignore-order", TextStylePatch),
				"use --text-style semantic",
				"or remove --ignore-path / --ignore-order",
			)
		}
		return TextStylePatch, nil
	case TextStyleSemantic:
		return TextStyleSemantic, nil
	default:
		return "", newUserHintError(
			fmt.Sprintf("invalid text style %q", opts.TextStyle),
			"allowed values: auto, patch, semantic",
			"try --text-style auto",
		)
	}
}

func resolveTextDiffStyle(opts CompareOptions) (string, error) {
	switch opts.TextStyle {
	case "", TextStyleAuto:
		if len(opts.IgnorePaths) > 0 {
			return TextStyleSemantic, nil
		}
		return TextStylePatch, nil
	case TextStylePatch:
		if len(opts.IgnorePaths) > 0 {
			return "", newUserHintError(
				fmt.Sprintf("text style %q cannot be used with --ignore-path", TextStylePatch),
				"use --text-style semantic",
				"or remove --ignore-path",
			)
		}
		return TextStylePatch, nil
	case TextStyleSemantic:
		return TextStyleSemantic, nil
	default:
		return "", newUserHintError(
			fmt.Sprintf("invalid text style %q", opts.TextStyle),
			"allowed values: auto, patch, semantic",
			"try --text-style auto",
		)
	}
}
