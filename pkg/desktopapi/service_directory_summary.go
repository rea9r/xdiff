package desktopapi

import (
	"bytes"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/rea9r/xdiff/internal/output"
)

const (
	defaultSummaryTotalBudget = 12000
	defaultSummaryPerFileCap  = 2000
	defaultSummaryMaxFileSize = int64(256 * 1024)
	binarySniffBytes          = 8000
)

// BuildDirectorySummaryContext composes a budget-bounded text representation
// of a directory diff suitable for feeding to a local LLM. For each "changed"
// file it materializes a unified diff, capping per-file output and stopping
// the greedy fill once the total budget is exhausted. Left-only/right-only
// entries are listed by path only.
func (s *Service) BuildDirectorySummaryContext(req DirectorySummaryRequest) (*DirectorySummaryResponse, error) {
	totalBudget := req.TotalBudget
	if totalBudget <= 0 {
		totalBudget = defaultSummaryTotalBudget
	}
	perFileCap := req.PerFileCap
	if perFileCap <= 0 {
		perFileCap = defaultSummaryPerFileCap
	}
	maxFileSize := req.MaxFileSize
	if maxFileSize <= 0 {
		maxFileSize = defaultSummaryMaxFileSize
	}

	resp := &DirectorySummaryResponse{
		FilesIncluded: []string{},
		FilesOmitted:  []string{},
		FilesSkipped:  []DirectorySummarySkipped{},
		BudgetTotal:   totalBudget,
	}

	changed := make([]DirectorySummaryItem, 0, len(req.Items))
	leftOnly := make([]DirectorySummaryItem, 0)
	rightOnly := make([]DirectorySummaryItem, 0)
	for _, item := range req.Items {
		if item.IsDir {
			continue
		}
		switch item.Status {
		case "changed":
			changed = append(changed, item)
		case "left-only":
			leftOnly = append(leftOnly, item)
		case "right-only":
			rightOnly = append(rightOnly, item)
		case "type-mismatch":
			resp.FilesSkipped = append(resp.FilesSkipped, DirectorySummarySkipped{
				Path: item.RelativePath, Reason: "type-mismatch",
			})
		case "error":
			resp.FilesSkipped = append(resp.FilesSkipped, DirectorySummarySkipped{
				Path: item.RelativePath, Reason: "directory-scan-error",
			})
		}
	}
	resp.TotalChanged = len(changed)
	resp.TotalLeftOnly = len(leftOnly)
	resp.TotalRightOnly = len(rightOnly)

	sort.Slice(changed, func(i, j int) bool { return changed[i].RelativePath < changed[j].RelativePath })
	sort.Slice(leftOnly, func(i, j int) bool { return leftOnly[i].RelativePath < leftOnly[j].RelativePath })
	sort.Slice(rightOnly, func(i, j int) bool { return rightOnly[i].RelativePath < rightOnly[j].RelativePath })

	var b strings.Builder
	used := 0

	writeIfFits := func(s string) bool {
		if used+len(s) > totalBudget {
			return false
		}
		b.WriteString(s)
		used += len(s)
		return true
	}

	header := fmt.Sprintf(
		"Directory diff summary: %d changed, %d added, %d removed.\n\n",
		len(changed), len(rightOnly), len(leftOnly),
	)
	b.WriteString(header)
	used += len(header)

	if len(changed) > 0 {
		intro := "# Detailed diffs (per-file unified diff, possibly truncated)\n\n"
		writeIfFits(intro)

		budgetExhausted := false
		for _, item := range changed {
			if budgetExhausted {
				resp.FilesOmitted = append(resp.FilesOmitted, item.RelativePath)
				continue
			}
			block, skip, err := buildFileDiffBlock(item, perFileCap, maxFileSize)
			if err != nil {
				resp.FilesSkipped = append(resp.FilesSkipped, DirectorySummarySkipped{
					Path: item.RelativePath, Reason: "read-error: " + err.Error(),
				})
				continue
			}
			if skip != "" {
				resp.FilesSkipped = append(resp.FilesSkipped, DirectorySummarySkipped{
					Path: item.RelativePath, Reason: skip,
				})
				continue
			}
			if used+len(block) > totalBudget {
				budgetExhausted = true
				resp.FilesOmitted = append(resp.FilesOmitted, item.RelativePath)
				continue
			}
			b.WriteString(block)
			used += len(block)
			resp.FilesIncluded = append(resp.FilesIncluded, item.RelativePath)
		}
	}

	if len(rightOnly) > 0 {
		section := fmt.Sprintf("\n# Added files (%d, content not shown)\n", len(rightOnly))
		writeIfFits(section)
		for _, item := range rightOnly {
			line := "  " + item.RelativePath + "\n"
			if !writeIfFits(line) {
				break
			}
		}
	}

	if len(leftOnly) > 0 {
		section := fmt.Sprintf("\n# Removed files (%d, content not shown)\n", len(leftOnly))
		writeIfFits(section)
		for _, item := range leftOnly {
			line := "  " + item.RelativePath + "\n"
			if !writeIfFits(line) {
				break
			}
		}
	}

	if len(resp.FilesOmitted) > 0 {
		section := fmt.Sprintf("\n# Files not detailed due to budget (%d)\n", len(resp.FilesOmitted))
		writeIfFits(section)
		for _, path := range resp.FilesOmitted {
			line := "  " + path + "\n"
			if !writeIfFits(line) {
				break
			}
		}
	}

	resp.Context = b.String()
	resp.BudgetUsed = used
	return resp, nil
}

func buildFileDiffBlock(item DirectorySummaryItem, perFileCap int, maxFileSize int64) (string, string, error) {
	if item.LeftPath == "" || item.RightPath == "" {
		return "", "missing-path", nil
	}

	leftInfo, err := os.Stat(item.LeftPath)
	if err != nil {
		return "", "", fmt.Errorf("stat left: %w", err)
	}
	rightInfo, err := os.Stat(item.RightPath)
	if err != nil {
		return "", "", fmt.Errorf("stat right: %w", err)
	}
	if leftInfo.Size() > maxFileSize || rightInfo.Size() > maxFileSize {
		return "", "too-large", nil
	}

	leftBytes, err := os.ReadFile(item.LeftPath) //nolint:gosec // G304: user-provided desktop input
	if err != nil {
		return "", "", fmt.Errorf("read left: %w", err)
	}
	rightBytes, err := os.ReadFile(item.RightPath) //nolint:gosec // G304: user-provided desktop input
	if err != nil {
		return "", "", fmt.Errorf("read right: %w", err)
	}
	if looksBinary(leftBytes) || looksBinary(rightBytes) {
		return "", "binary", nil
	}

	leftText := string(leftBytes)
	rightText := string(rightBytes)
	unified := output.RenderUnifiedTextWithDisplay(leftText, rightText, leftText, rightText)
	if unified == "" {
		// CompareWithDisplay returned no diffs (e.g. EOL-only difference that
		// the directory scanner flagged as different but textdiff considers
		// equal). Skip — no useful content for AI.
		return "", "", nil
	}

	if len(unified) > perFileCap {
		unified = unified[:perFileCap] + "\n... [truncated]\n"
	}

	header := "## changed: " + item.RelativePath + "\n```diff\n"
	footer := "```\n\n"
	return header + unified + footer, "", nil
}

func looksBinary(b []byte) bool {
	limit := len(b)
	if limit > binarySniffBytes {
		limit = binarySniffBytes
	}
	return bytes.IndexByte(b[:limit], 0) >= 0
}
