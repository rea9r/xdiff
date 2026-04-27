package desktopapi

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeTempFile(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
	return path
}

func TestBuildDirectorySummaryContext_IncludesUnifiedDiffPerChangedFile(t *testing.T) {
	dir := t.TempDir()
	leftA := writeTempFile(t, dir, "a-left.txt", "hello\nworld\n")
	rightA := writeTempFile(t, dir, "a-right.txt", "hello\ngopher\n")

	svc := NewService()
	resp, err := svc.BuildDirectorySummaryContext(DirectorySummaryRequest{
		Items: []DirectorySummaryItem{
			{RelativePath: "a.txt", Status: "changed", LeftPath: leftA, RightPath: rightA},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(resp.FilesIncluded) != 1 || resp.FilesIncluded[0] != "a.txt" {
		t.Fatalf("expected a.txt in FilesIncluded, got %v", resp.FilesIncluded)
	}
	if !strings.Contains(resp.Context, "## changed: a.txt") {
		t.Fatalf("expected file header in context, got:\n%s", resp.Context)
	}
	if !strings.Contains(resp.Context, "-world") || !strings.Contains(resp.Context, "+gopher") {
		t.Fatalf("expected unified-diff lines in context, got:\n%s", resp.Context)
	}
	if resp.TotalChanged != 1 {
		t.Fatalf("expected TotalChanged=1, got %d", resp.TotalChanged)
	}
}

func TestBuildDirectorySummaryContext_GreedyBudgetOmitsLaterFiles(t *testing.T) {
	dir := t.TempDir()
	bigOld := strings.Repeat("alpha line\n", 200)
	bigNew := strings.Repeat("beta line\n", 200)
	leftA := writeTempFile(t, dir, "a-left.txt", bigOld)
	rightA := writeTempFile(t, dir, "a-right.txt", bigNew)
	leftB := writeTempFile(t, dir, "b-left.txt", bigOld)
	rightB := writeTempFile(t, dir, "b-right.txt", bigNew)

	svc := NewService()
	resp, err := svc.BuildDirectorySummaryContext(DirectorySummaryRequest{
		Items: []DirectorySummaryItem{
			{RelativePath: "a.txt", Status: "changed", LeftPath: leftA, RightPath: rightA},
			{RelativePath: "b.txt", Status: "changed", LeftPath: leftB, RightPath: rightB},
		},
		TotalBudget: 800,
		PerFileCap:  500,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(resp.FilesIncluded) != 1 {
		t.Fatalf("expected exactly one file to fit budget=800, got %v", resp.FilesIncluded)
	}
	if len(resp.FilesOmitted) != 1 || resp.FilesOmitted[0] != "b.txt" {
		t.Fatalf("expected b.txt omitted, got %v", resp.FilesOmitted)
	}
	if !strings.Contains(resp.Context, "Files not detailed due to budget") {
		t.Fatalf("expected budget-omission section, got:\n%s", resp.Context)
	}
}

func TestBuildDirectorySummaryContext_SkipsBinaryAndOversize(t *testing.T) {
	dir := t.TempDir()
	binLeft := writeTempFile(t, dir, "bin-left", "hello\x00world\n")
	binRight := writeTempFile(t, dir, "bin-right", "hello\x00gopher\n")
	bigLeft := writeTempFile(t, dir, "big-left.txt", strings.Repeat("x\n", 200))
	bigRight := writeTempFile(t, dir, "big-right.txt", strings.Repeat("y\n", 200))

	svc := NewService()
	resp, err := svc.BuildDirectorySummaryContext(DirectorySummaryRequest{
		Items: []DirectorySummaryItem{
			{RelativePath: "bin", Status: "changed", LeftPath: binLeft, RightPath: binRight},
			{RelativePath: "big.txt", Status: "changed", LeftPath: bigLeft, RightPath: bigRight},
		},
		MaxFileSize: 100,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	reasons := map[string]string{}
	for _, s := range resp.FilesSkipped {
		reasons[s.Path] = s.Reason
	}
	if reasons["bin"] != "binary" {
		t.Fatalf("expected bin skipped as binary, got %q", reasons["bin"])
	}
	if reasons["big.txt"] != "too-large" {
		t.Fatalf("expected big.txt skipped as too-large, got %q", reasons["big.txt"])
	}
	if len(resp.FilesIncluded) != 0 {
		t.Fatalf("expected no files included, got %v", resp.FilesIncluded)
	}
}

func TestBuildDirectorySummaryContext_ListsLeftAndRightOnly(t *testing.T) {
	svc := NewService()
	resp, err := svc.BuildDirectorySummaryContext(DirectorySummaryRequest{
		Items: []DirectorySummaryItem{
			{RelativePath: "old.go", Status: "left-only"},
			{RelativePath: "new.ts", Status: "right-only"},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(resp.Context, "Added files (1") || !strings.Contains(resp.Context, "new.ts") {
		t.Fatalf("expected right-only section listing new.ts, got:\n%s", resp.Context)
	}
	if !strings.Contains(resp.Context, "Removed files (1") || !strings.Contains(resp.Context, "old.go") {
		t.Fatalf("expected left-only section listing old.go, got:\n%s", resp.Context)
	}
	if resp.TotalLeftOnly != 1 || resp.TotalRightOnly != 1 {
		t.Fatalf("expected counts 1/1, got left=%d right=%d", resp.TotalLeftOnly, resp.TotalRightOnly)
	}
}
