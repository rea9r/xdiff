package scenario

import (
	"encoding/json"
	"fmt"
	"strings"
)

func RenderText(summary Summary, results []Result, scenarioPath string) string {
	var b strings.Builder

	fmt.Fprintf(&b, "Scenario: %s\n\n", scenarioPath)
	for _, result := range results {
		fmt.Fprintf(&b, "[%s] %s (%s)\n", strings.ToUpper(result.Status), result.Name, result.Kind)
	}

	fmt.Fprintf(&b, "\nSummary: total=%d ok=%d diff=%d error=%d\n", summary.Total, summary.OK, summary.Diff, summary.Error)

	for _, result := range results {
		if result.Status == StatusOK {
			continue
		}
		fmt.Fprintf(&b, "\n=== %s ===\n", result.Name)
		if result.ErrorMessage != "" {
			fmt.Fprintf(&b, "error: %s\n", result.ErrorMessage)
		}
		if result.Output != "" {
			b.WriteString(result.Output)
			if !strings.HasSuffix(result.Output, "\n") {
				b.WriteByte('\n')
			}
		}
	}

	return b.String()
}

func RenderJSON(summary Summary, results []Result) (string, error) {
	payload := struct {
		Summary Summary  `json:"summary"`
		Results []Result `json:"results"`
	}{
		Summary: summary,
		Results: results,
	}

	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(raw) + "\n", nil
}
