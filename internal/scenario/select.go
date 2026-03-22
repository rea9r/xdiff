package scenario

import (
	"fmt"
	"sort"
	"strings"
)

func FilterResolvedChecks(checks []ResolvedCheck, only []string) ([]ResolvedCheck, error) {
	if len(only) == 0 {
		out := make([]ResolvedCheck, len(checks))
		copy(out, checks)
		return out, nil
	}

	wanted := make(map[string]struct{}, len(only))
	for _, name := range only {
		if name == "" {
			continue
		}
		wanted[name] = struct{}{}
	}

	selected := make([]ResolvedCheck, 0, len(checks))
	found := make(map[string]struct{}, len(wanted))
	for _, check := range checks {
		if _, ok := wanted[check.Name]; !ok {
			continue
		}
		selected = append(selected, check)
		found[check.Name] = struct{}{}
	}

	if len(found) == len(wanted) {
		return selected, nil
	}

	missing := make([]string, 0, len(wanted)-len(found))
	for name := range wanted {
		if _, ok := found[name]; !ok {
			missing = append(missing, name)
		}
	}
	sort.Strings(missing)

	available := make([]string, 0, len(checks))
	for _, check := range checks {
		available = append(available, check.Name)
	}

	return nil, fmt.Errorf("unknown check name(s): %s (try: xdiff run --list <scenario-file>; available: %s)", strings.Join(missing, ", "), strings.Join(available, ", "))
}
