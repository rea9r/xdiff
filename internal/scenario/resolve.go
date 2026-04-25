package scenario

import (
	"fmt"
	"path/filepath"

	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/runner"
)

func Resolve(cfg Config, scenarioPath string) ([]ResolvedCheck, error) {
	baseDir := filepath.Dir(scenarioPath)
	seen := make(map[string]struct{}, len(cfg.Checks))
	resolved := make([]ResolvedCheck, 0, len(cfg.Checks))

	for i, check := range cfg.Checks {
		if check.Name == "" {
			return nil, fmt.Errorf("checks[%d]: name is required", i)
		}
		if _, ok := seen[check.Name]; ok {
			return nil, fmt.Errorf("duplicate check name %q", check.Name)
		}
		seen[check.Name] = struct{}{}

		one, err := resolveCheck(cfg.Defaults, check, baseDir)
		if err != nil {
			return nil, fmt.Errorf("check %q: %w", check.Name, err)
		}
		resolved = append(resolved, one)
	}

	return resolved, nil
}

func resolveCheck(defaults Defaults, check Check, baseDir string) (ResolvedCheck, error) {
	if !isSupportedKind(check.Kind) {
		return ResolvedCheck{}, fmt.Errorf("unsupported kind %q (allowed: json, text)", check.Kind)
	}
	if check.Old == "" || check.New == "" {
		return ResolvedCheck{}, fmt.Errorf("old and new are required")
	}

	resolved := ResolvedCheck{
		Name: check.Name,
		Kind: check.Kind,
		Old:  resolveLocalPath(baseDir, check.Old),
		New:  resolveLocalPath(baseDir, check.New),
		Compare: runner.CompareOptions{
			Format:       firstNonEmpty(check.OutputFormat, defaults.OutputFormat, output.TextFormat),
			FailOn:       firstNonEmpty(check.FailOn, defaults.FailOn, runner.FailOnAny),
			IgnorePaths:  firstSlice(check.IgnorePaths, defaults.IgnorePaths),
			ShowPaths:    firstBool(check.ShowPaths, defaults.ShowPaths, false),
			OnlyBreaking: firstBool(check.OnlyBreaking, defaults.OnlyBreaking, false),
			TextStyle:    firstNonEmpty(check.TextStyle, defaults.TextStyle, runner.TextStyleAuto),
			UseColor:     !firstBool(check.NoColor, defaults.NoColor, false),
			IgnoreOrder:  firstBool(check.IgnoreOrder, defaults.IgnoreOrder, false),
		},
	}

	return resolved, nil
}

func isSupportedKind(kind string) bool {
	switch kind {
	case KindJSON, KindText:
		return true
	default:
		return false
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func firstSlice(primary []string, fallback []string) []string {
	if primary != nil {
		return append([]string(nil), primary...)
	}
	if fallback != nil {
		return append([]string(nil), fallback...)
	}
	return nil
}

func firstBool(primary, fallback *bool, def bool) bool {
	if primary != nil {
		return *primary
	}
	if fallback != nil {
		return *fallback
	}
	return def
}

func resolveLocalPath(baseDir string, p string) string {
	if filepath.IsAbs(p) {
		return filepath.Clean(p)
	}
	return filepath.Clean(filepath.Join(baseDir, p))
}
