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

func resolveJSONTextStyle(opts DiffOptions) (string, error) {
	switch opts.TextStyle {
	case "", TextStyleAuto:
		if len(opts.IgnorePaths) > 0 || opts.IgnoreOrder {
			return TextStyleSemantic, nil
		}
		return TextStylePatch, nil
	case TextStylePatch:
		if len(opts.IgnorePaths) > 0 || opts.IgnoreOrder {
			return "", fmt.Errorf("text style %q cannot be used with ignore-path or ignore-order; use semantic", TextStylePatch)
		}
		return TextStylePatch, nil
	case TextStyleSemantic:
		return TextStyleSemantic, nil
	default:
		return "", fmt.Errorf("invalid text style %q (allowed: auto, patch, semantic)", opts.TextStyle)
	}
}

func resolveTextDiffStyle(opts DiffOptions) (string, error) {
	switch opts.TextStyle {
	case "", TextStyleAuto:
		if len(opts.IgnorePaths) > 0 {
			return TextStyleSemantic, nil
		}
		return TextStylePatch, nil
	case TextStylePatch:
		if len(opts.IgnorePaths) > 0 {
			return "", fmt.Errorf("text style %q cannot be used with ignore-path; use semantic", TextStylePatch)
		}
		return TextStylePatch, nil
	case TextStyleSemantic:
		return TextStyleSemantic, nil
	default:
		return "", fmt.Errorf("invalid text style %q (allowed: auto, patch, semantic)", opts.TextStyle)
	}
}
