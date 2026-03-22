package scenario

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
)

type CheckListEntry struct {
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	Old     string `json:"old"`
	New     string `json:"new"`
	Summary string `json:"summary"`
}

func RenderCheckListText(checks []ResolvedCheck, scenarioPath string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Scenario: %s\n\n", scenarioPath)
	for _, check := range checks {
		fmt.Fprintf(&b, "- %s (%s) %s\n", check.Name, check.Kind, summarizeCheckTarget(check, scenarioPath))
	}
	return b.String()
}

func RenderCheckListJSON(checks []ResolvedCheck, scenarioPath string) (string, error) {
	entries := BuildCheckListEntries(checks, scenarioPath)

	payload := struct {
		Checks []CheckListEntry `json:"checks"`
	}{
		Checks: entries,
	}

	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(raw) + "\n", nil
}

func BuildCheckListEntries(checks []ResolvedCheck, scenarioPath string) []CheckListEntry {
	entries := make([]CheckListEntry, 0, len(checks))
	for _, check := range checks {
		oldDisplay, newDisplay := displayTargets(check, scenarioPath)
		entries = append(entries, CheckListEntry{
			Name:    check.Name,
			Kind:    check.Kind,
			Old:     oldDisplay,
			New:     newDisplay,
			Summary: summarizeCheckTarget(check, scenarioPath),
		})
	}
	return entries
}

func summarizeCheckTarget(check ResolvedCheck, scenarioPath string) string {
	oldDisplay, newDisplay := displayTargets(check, scenarioPath)
	return fmt.Sprintf("%s -> %s", oldDisplay, newDisplay)
}

func displayTargets(check ResolvedCheck, scenarioPath string) (string, string) {
	switch check.Kind {
	case KindURL:
		return check.Old, check.New
	default:
		baseDir := filepath.Dir(scenarioPath)
		return relativizePath(baseDir, check.Old), relativizePath(baseDir, check.New)
	}
}

func relativizePath(baseDir, target string) string {
	if target == "" {
		return ""
	}

	rel, err := filepath.Rel(baseDir, target)
	if err != nil {
		return target
	}
	if rel == "." {
		return target
	}
	return rel
}
