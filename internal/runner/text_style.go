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
		if len(opts.IgnorePaths) > 0 || opts.OnlyBreaking || opts.IgnoreOrder {
			return TextStyleSemantic, nil
		}
		return TextStylePatch, nil
	case TextStylePatch:
		if len(opts.IgnorePaths) > 0 || opts.OnlyBreaking || opts.IgnoreOrder {
			return "", newUserHintError(
				fmt.Sprintf("text style %q cannot be used with --ignore-path, --only-breaking, or --ignore-order", TextStylePatch),
				"use --text-style semantic",
				"or remove --ignore-path / --only-breaking / --ignore-order",
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
		if len(opts.IgnorePaths) > 0 || opts.OnlyBreaking {
			return TextStyleSemantic, nil
		}
		return TextStylePatch, nil
	case TextStylePatch:
		if len(opts.IgnorePaths) > 0 || opts.OnlyBreaking {
			return "", newUserHintError(
				fmt.Sprintf("text style %q cannot be used with --ignore-path or --only-breaking", TextStylePatch),
				"use --text-style semantic",
				"or remove --ignore-path / --only-breaking",
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

func resolveDeltaTextStyle(opts CompareOptions) (string, error) {
	switch opts.TextStyle {
	case "", TextStyleAuto, TextStyleSemantic:
		return TextStyleSemantic, nil
	case TextStylePatch:
		return "", newUserHintError(
			fmt.Sprintf("text style %q is not supported for delta-only comparisons", TextStylePatch),
			"use --text-style semantic",
			"or use --output-format json",
		)
	default:
		return "", newUserHintError(
			fmt.Sprintf("invalid text style %q", opts.TextStyle),
			"allowed values: auto, patch, semantic",
			"try --text-style semantic",
		)
	}
}
