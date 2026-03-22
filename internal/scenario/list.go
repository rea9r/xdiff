package scenario

import (
	"encoding/json"
	"fmt"
	"strings"
)

type CheckListEntry struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
}

func RenderCheckListText(checks []ResolvedCheck, scenarioPath string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Scenario: %s\n\n", scenarioPath)
	for _, check := range checks {
		fmt.Fprintf(&b, "- %s (%s)\n", check.Name, check.Kind)
	}
	return b.String()
}

func RenderCheckListJSON(checks []ResolvedCheck) (string, error) {
	entries := make([]CheckListEntry, 0, len(checks))
	for _, check := range checks {
		entries = append(entries, CheckListEntry{
			Name: check.Name,
			Kind: check.Kind,
		})
	}

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
