package desktopapi

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeFile(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("mkdir failed: %v", err)
	}
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write failed: %v", err)
	}
}

func findFolderItem(t *testing.T, items []FolderCompareItem, relativePath string) FolderCompareItem {
	t.Helper()
	for _, item := range items {
		if item.RelativePath == relativePath {
			return item
		}
	}
	t.Fatalf("item %q not found", relativePath)
	return FolderCompareItem{}
}

func TestCompareJSONFiles(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "old.json")
	newPath := filepath.Join(tmp, "new.json")

	writeFile(t, oldPath, `{"user":{"name":"Taro"}}`)
	writeFile(t, newPath, `{"user":{"name":"Hanako"}}`)

	svc := NewService()
	res, err := svc.CompareJSONFiles(CompareJSONRequest{
		OldPath: oldPath,
		NewPath: newPath,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "auto",
		},
	})
	if err != nil {
		t.Fatalf("CompareJSONFiles returned error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.ExitCode != 1 {
		t.Fatalf("expected exitCode 1, got %d", res.ExitCode)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if strings.TrimSpace(res.Output) == "" {
		t.Fatal("expected output")
	}
}

func TestCompareJSONRich_Basic(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "old.json")
	newPath := filepath.Join(tmp, "new.json")

	writeFile(t, oldPath, `{"name":"Taro","age":"20","email":"old@example.com"}`)
	writeFile(t, newPath, `{"name":"Hanako","age":20,"phone":"090-xxxx-xxxx"}`)

	svc := NewService()
	rawRes, err := svc.CompareJSONFiles(CompareJSONRequest{
		OldPath: oldPath,
		NewPath: newPath,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
		},
	})
	if err != nil {
		t.Fatalf("CompareJSONFiles returned error: %v", err)
	}

	richRes, err := svc.CompareJSONRich(CompareJSONRequest{
		OldPath: oldPath,
		NewPath: newPath,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
		},
	})
	if err != nil {
		t.Fatalf("CompareJSONRich returned error: %v", err)
	}
	if richRes == nil {
		t.Fatal("expected response")
	}
	if richRes.Result.ExitCode != rawRes.ExitCode ||
		richRes.Result.DiffFound != rawRes.DiffFound ||
		richRes.Result.Output != rawRes.Output ||
		richRes.Result.Error != rawRes.Error {
		t.Fatalf("raw compare result mismatch: got %+v, want %+v", richRes.Result, *rawRes)
	}
	if strings.TrimSpace(richRes.DiffText) == "" {
		t.Fatal("expected diff text")
	}
	if len(richRes.Diffs) == 0 {
		t.Fatal("expected rich diffs")
	}

	seenPath := map[string]bool{}
	seenType := map[string]bool{}
	for _, item := range richRes.Diffs {
		seenPath[item.Path] = true
		seenType[item.Type] = true
		if (item.Type == "removed" || item.Type == "type_changed") && !item.Breaking {
			t.Fatalf("expected breaking=true for type=%s", item.Type)
		}
	}

	if !seenPath["name"] || !seenPath["age"] || !seenPath["email"] || !seenPath["phone"] {
		t.Fatalf("expected canonical paths in rich diffs, got: %+v", richRes.Diffs)
	}
	if !seenType["changed"] || !seenType["type_changed"] || !seenType["removed"] || !seenType["added"] {
		t.Fatalf("expected all diff types in rich diffs, got: %+v", richRes.Diffs)
	}
	if richRes.Summary.Breaking < 2 {
		t.Fatalf("expected at least 2 breaking diffs, got summary: %+v", richRes.Summary)
	}
}

func TestCompareJSONRich_OnlyBreaking(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "old.json")
	newPath := filepath.Join(tmp, "new.json")

	writeFile(t, oldPath, `{"name":"Taro","age":"20","email":"old@example.com"}`)
	writeFile(t, newPath, `{"name":"Hanako","age":20}`)

	svc := NewService()
	richRes, err := svc.CompareJSONRich(CompareJSONRequest{
		OldPath: oldPath,
		NewPath: newPath,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
			OnlyBreaking: true,
		},
	})
	if err != nil {
		t.Fatalf("CompareJSONRich returned error: %v", err)
	}

	for _, item := range richRes.Diffs {
		if item.Type != "removed" && item.Type != "type_changed" {
			t.Fatalf("expected only breaking types, got %s", item.Type)
		}
		if !item.Breaking {
			t.Fatalf("expected breaking=true for %s", item.Type)
		}
	}
}

func TestCompareJSONRich_IgnorePaths(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "old.json")
	newPath := filepath.Join(tmp, "new.json")

	writeFile(t, oldPath, `{"name":"Taro","age":20,"email":"old@example.com"}`)
	writeFile(t, newPath, `{"name":"Hanako","age":20,"email":"new@example.com"}`)

	svc := NewService()
	richRes, err := svc.CompareJSONRich(CompareJSONRequest{
		OldPath: oldPath,
		NewPath: newPath,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
			IgnorePaths:  []string{"name"},
		},
	})
	if err != nil {
		t.Fatalf("CompareJSONRich returned error: %v", err)
	}

	for _, item := range richRes.Diffs {
		if item.Path == "name" {
			t.Fatalf("expected ignorePaths to suppress name diff, got %+v", richRes.Diffs)
		}
	}
}

func TestCompareJSONRich_IgnoreOrder(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "old.json")
	newPath := filepath.Join(tmp, "new.json")

	writeFile(t, oldPath, `{"items":[1,2,3]}`)
	writeFile(t, newPath, `{"items":[3,2,1]}`)

	svc := NewService()
	richRes, err := svc.CompareJSONRich(CompareJSONRequest{
		OldPath: oldPath,
		NewPath: newPath,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
		},
		IgnoreOrder: true,
	})
	if err != nil {
		t.Fatalf("CompareJSONRich returned error: %v", err)
	}

	if richRes.Result.DiffFound {
		t.Fatalf("expected no diff when ignoreOrder=true, got %+v", richRes.Result)
	}
	if len(richRes.Diffs) != 0 {
		t.Fatalf("expected no rich diffs, got %+v", richRes.Diffs)
	}
	if richRes.Summary != (JSONRichSummary{}) {
		t.Fatalf("expected empty summary, got %+v", richRes.Summary)
	}
}

func TestCompareJSONValuesRich_Basic(t *testing.T) {
	svc := NewService()

	res, err := svc.CompareJSONValuesRich(CompareJSONValuesRequest{
		OldValue: `{"name":"Taro","age":"20","email":"old@example.com"}`,
		NewValue: `{"name":"Hanako","age":20,"phone":"090-xxxx-xxxx"}`,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
		},
	})
	if err != nil {
		t.Fatalf("CompareJSONValuesRich returned error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if !res.Result.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if strings.TrimSpace(res.Result.Output) == "" {
		t.Fatal("expected output")
	}
	if strings.TrimSpace(res.DiffText) == "" {
		t.Fatal("expected diff text")
	}
	if len(res.Diffs) == 0 {
		t.Fatal("expected structured diffs")
	}
	if res.Summary.Breaking == 0 {
		t.Fatalf("expected breaking diffs, got summary: %+v", res.Summary)
	}
}

func TestCompareJSONValuesRich_InvalidOldJSON(t *testing.T) {
	svc := NewService()

	_, err := svc.CompareJSONValuesRich(CompareJSONValuesRequest{
		OldValue: `{`,
		NewValue: `{"name":"Hanako"}`,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
		},
	})
	if err == nil {
		t.Fatal("expected error for invalid old JSON")
	}
	if !strings.Contains(err.Error(), "invalid old JSON") {
		t.Fatalf("expected invalid old JSON error, got: %v", err)
	}
}

func TestCompareJSONValuesRich_InvalidNewJSON(t *testing.T) {
	svc := NewService()

	_, err := svc.CompareJSONValuesRich(CompareJSONValuesRequest{
		OldValue: `{"name":"Taro"}`,
		NewValue: `{`,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
		},
	})
	if err == nil {
		t.Fatal("expected error for invalid new JSON")
	}
	if !strings.Contains(err.Error(), "invalid new JSON") {
		t.Fatalf("expected invalid new JSON error, got: %v", err)
	}
}

func TestCompareJSONValuesRich_IgnoreOrder(t *testing.T) {
	svc := NewService()

	res, err := svc.CompareJSONValuesRich(CompareJSONValuesRequest{
		OldValue: `{"items":[1,2,3]}`,
		NewValue: `{"items":[3,2,1]}`,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
		},
		IgnoreOrder: true,
	})
	if err != nil {
		t.Fatalf("CompareJSONValuesRich returned error: %v", err)
	}
	if res.Result.DiffFound {
		t.Fatalf("expected no diff when ignoreOrder=true, got %+v", res.Result)
	}
	if len(res.Diffs) != 0 {
		t.Fatalf("expected no diffs, got %+v", res.Diffs)
	}
}

func TestCompareJSONValuesRich_IgnorePaths(t *testing.T) {
	svc := NewService()

	res, err := svc.CompareJSONValuesRich(CompareJSONValuesRequest{
		OldValue: `{"name":"Taro","age":20}`,
		NewValue: `{"name":"Hanako","age":20}`,
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "semantic",
			IgnorePaths:  []string{"name"},
		},
	})
	if err != nil {
		t.Fatalf("CompareJSONValuesRich returned error: %v", err)
	}
	if res.Result.DiffFound {
		t.Fatalf("expected no diff when ignorePaths suppresses all, got %+v", res.Result)
	}
	if len(res.Diffs) != 0 {
		t.Fatalf("expected no diffs, got %+v", res.Diffs)
	}
}

func TestCompareText(t *testing.T) {
	svc := NewService()
	res, err := svc.CompareText(CompareTextRequest{
		OldText: "hello\nworld\n",
		NewText: "hello\nxdiff\n",
		Common: CompareCommon{
			FailOn:       "any",
			OutputFormat: "text",
			TextStyle:    "auto",
		},
	})
	if err != nil {
		t.Fatalf("CompareText returned error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.ExitCode != 1 {
		t.Fatalf("expected exitCode 1, got %d", res.ExitCode)
	}
	if !res.DiffFound {
		t.Fatal("expected diffFound=true")
	}
	if strings.TrimSpace(res.Output) == "" {
		t.Fatal("expected output")
	}
}

func TestListScenarioChecks(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "snapshots", "old.json")
	newPath := filepath.Join(tmp, "snapshots", "new.json")
	scenarioPath := filepath.Join(tmp, "xdiff.yaml")

	writeFile(t, oldPath, `{"user":{"name":"Taro"}}`)
	writeFile(t, newPath, `{"user":{"name":"Hanako"}}`)
	writeFile(t, scenarioPath, `
version: 1
checks:
  - name: local-user-json
    kind: json
    old: snapshots/old.json
    new: snapshots/new.json
`)

	svc := NewService()
	res, err := svc.ListScenarioChecks(ListScenarioChecksRequest{
		ScenarioPath: scenarioPath,
		ReportFormat: "text",
	})
	if err != nil {
		t.Fatalf("ListScenarioChecks returned error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.ExitCode != 0 {
		t.Fatalf("expected exitCode 0, got %d", res.ExitCode)
	}
	if len(res.Checks) != 1 {
		t.Fatalf("expected 1 check, got %d", len(res.Checks))
	}
	if res.Checks[0].Name != "local-user-json" {
		t.Fatalf("unexpected check name: %s", res.Checks[0].Name)
	}
}

func TestRunScenario(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "snapshots", "old.json")
	newPath := filepath.Join(tmp, "snapshots", "new.json")
	scenarioPath := filepath.Join(tmp, "xdiff.yaml")

	writeFile(t, oldPath, `{"user":{"name":"Taro"}}`)
	writeFile(t, newPath, `{"user":{"name":"Hanako"}}`)
	writeFile(t, scenarioPath, `
version: 1
checks:
  - name: local-user-json
    kind: json
    old: snapshots/old.json
    new: snapshots/new.json
`)

	svc := NewService()
	res, err := svc.RunScenario(RunScenarioRequest{
		ScenarioPath: scenarioPath,
		ReportFormat: "text",
	})
	if err != nil {
		t.Fatalf("RunScenario returned error: %v", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.Summary == nil {
		t.Fatal("expected summary")
	}
	if len(res.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(res.Results))
	}
}

func TestLoadTextFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sample.txt")
	want := "hello\nworld\n"

	if err := os.WriteFile(path, []byte(want), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	svc := NewService()
	got, err := svc.LoadTextFile(LoadTextFileRequest{Path: path})
	if err != nil {
		t.Fatalf("LoadTextFile() error = %v", err)
	}

	if got.Path != path {
		t.Fatalf("LoadTextFile() path = %q, want %q", got.Path, path)
	}

	if got.Content != want {
		t.Fatalf("LoadTextFile() content = %q, want %q", got.Content, want)
	}
}

func TestLoadTextFileRejectsNonUTF8(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "binary.bin")

	if err := os.WriteFile(path, []byte{0xff, 0xfe, 0xfd}, 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	svc := NewService()
	_, err := svc.LoadTextFile(LoadTextFileRequest{Path: path})
	if err == nil {
		t.Fatal("LoadTextFile() error = nil, want non-nil")
	}
}

func TestCompareFolders_NavigateRootListing(t *testing.T) {
	leftRoot := filepath.Join(t.TempDir(), "left")
	rightRoot := filepath.Join(t.TempDir(), "right")

	writeFile(t, filepath.Join(leftRoot, "alpha", "same.txt"), "hello\n")
	writeFile(t, filepath.Join(rightRoot, "alpha", "same.txt"), "hello\n")
	writeFile(t, filepath.Join(leftRoot, "beta.txt"), "old\n")
	writeFile(t, filepath.Join(rightRoot, "beta.txt"), "new\n")

	svc := NewService()
	res, err := svc.CompareFolders(CompareFoldersRequest{
		LeftRoot:    leftRoot,
		RightRoot:   rightRoot,
		CurrentPath: "",
		Recursive:   true,
		ShowSame:    true,
	})
	if err != nil {
		t.Fatalf("CompareFolders() error = %v", err)
	}
	if res.Error != "" {
		t.Fatalf("CompareFolders() response error = %s", res.Error)
	}
	if res.CurrentPath != "" {
		t.Fatalf("expected currentPath root, got %q", res.CurrentPath)
	}
	if len(res.Items) != 2 {
		t.Fatalf("expected 2 root items, got %d", len(res.Items))
	}
	if !res.Items[0].IsDir || res.Items[0].Name != "alpha" {
		t.Fatalf("expected first item to be alpha dir, got %+v", res.Items[0])
	}
	if res.Items[1].IsDir || res.Items[1].Name != "beta.txt" {
		t.Fatalf("expected second item to be beta.txt file, got %+v", res.Items[1])
	}
}

func TestCompareFolders_NavigateChildDirectory(t *testing.T) {
	leftRoot := filepath.Join(t.TempDir(), "left")
	rightRoot := filepath.Join(t.TempDir(), "right")

	writeFile(t, filepath.Join(leftRoot, "src", "same.txt"), "same\n")
	writeFile(t, filepath.Join(rightRoot, "src", "same.txt"), "same\n")
	writeFile(t, filepath.Join(leftRoot, "src", "diff.txt"), "left\n")
	writeFile(t, filepath.Join(rightRoot, "src", "diff.txt"), "right\n")

	svc := NewService()
	res, err := svc.CompareFolders(CompareFoldersRequest{
		LeftRoot:    leftRoot,
		RightRoot:   rightRoot,
		CurrentPath: "src",
		Recursive:   true,
		ShowSame:    true,
	})
	if err != nil {
		t.Fatalf("CompareFolders() error = %v", err)
	}
	if res.Error != "" {
		t.Fatalf("CompareFolders() response error = %s", res.Error)
	}
	if res.CurrentPath != "src" {
		t.Fatalf("expected currentPath src, got %q", res.CurrentPath)
	}
	if res.ParentPath != "" {
		t.Fatalf("expected parentPath root, got %q", res.ParentPath)
	}
	if len(res.Items) != 2 {
		t.Fatalf("expected 2 items under src, got %d", len(res.Items))
	}
}

func TestCompareFolders_DirectoryAggregateStatus(t *testing.T) {
	leftRoot := filepath.Join(t.TempDir(), "left")
	rightRoot := filepath.Join(t.TempDir(), "right")

	writeFile(t, filepath.Join(leftRoot, "svc", "config.txt"), "left\n")
	writeFile(t, filepath.Join(rightRoot, "svc", "config.txt"), "right\n")

	svc := NewService()
	res, err := svc.CompareFolders(CompareFoldersRequest{
		LeftRoot:    leftRoot,
		RightRoot:   rightRoot,
		CurrentPath: "",
		Recursive:   true,
		ShowSame:    true,
	})
	if err != nil {
		t.Fatalf("CompareFolders() error = %v", err)
	}
	if res.Error != "" {
		t.Fatalf("CompareFolders() response error = %s", res.Error)
	}
	if len(res.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(res.Items))
	}
	if res.Items[0].RelativePath != "svc" || res.Items[0].Status != "changed" {
		t.Fatalf("unexpected root item: %+v", res.Items[0])
	}
}

func TestCompareFolders_CurrentSummaryVsScannedSummary(t *testing.T) {
	leftRoot := filepath.Join(t.TempDir(), "left")
	rightRoot := filepath.Join(t.TempDir(), "right")

	writeFile(t, filepath.Join(leftRoot, "same.txt"), "same\n")
	writeFile(t, filepath.Join(rightRoot, "same.txt"), "same\n")
	writeFile(t, filepath.Join(leftRoot, "sub", "diff.txt"), "old\n")
	writeFile(t, filepath.Join(rightRoot, "sub", "diff.txt"), "new\n")

	svc := NewService()
	res, err := svc.CompareFolders(CompareFoldersRequest{
		LeftRoot:    leftRoot,
		RightRoot:   rightRoot,
		CurrentPath: "",
		Recursive:   true,
		ShowSame:    true,
	})
	if err != nil {
		t.Fatalf("CompareFolders() error = %v", err)
	}
	if res.Error != "" {
		t.Fatalf("CompareFolders() response error = %s", res.Error)
	}
	if res.ScannedSummary.Total <= res.CurrentSummary.Total {
		t.Fatalf("expected scanned summary to include more entries, got scanned=%+v current=%+v", res.ScannedSummary, res.CurrentSummary)
	}
}

func TestCompareFolders_NameFilterOnCurrentFolder(t *testing.T) {
	leftRoot := filepath.Join(t.TempDir(), "left")
	rightRoot := filepath.Join(t.TempDir(), "right")

	writeFile(t, filepath.Join(leftRoot, "alpha.txt"), "same\n")
	writeFile(t, filepath.Join(rightRoot, "alpha.txt"), "same\n")
	writeFile(t, filepath.Join(leftRoot, "beta.txt"), "old\n")
	writeFile(t, filepath.Join(rightRoot, "beta.txt"), "new\n")

	svc := NewService()
	res, err := svc.CompareFolders(CompareFoldersRequest{
		LeftRoot:    leftRoot,
		RightRoot:   rightRoot,
		CurrentPath: "",
		Recursive:   true,
		ShowSame:    true,
		NameFilter:  "BETA",
	})
	if err != nil {
		t.Fatalf("CompareFolders() error = %v", err)
	}
	if res.Error != "" {
		t.Fatalf("CompareFolders() response error = %s", res.Error)
	}

	if len(res.Items) != 1 {
		t.Fatalf("expected 1 filtered item, got %d", len(res.Items))
	}
	if res.Items[0].Name != "beta.txt" {
		t.Fatalf("expected beta.txt, got %+v", res.Items[0])
	}
}

func TestCompareFolders_OpenableHints(t *testing.T) {
	leftRoot := filepath.Join(t.TempDir(), "left")
	rightRoot := filepath.Join(t.TempDir(), "right")

	writeFile(t, filepath.Join(leftRoot, "payload.json"), `{"v":1}`)
	writeFile(t, filepath.Join(rightRoot, "payload.json"), `{"v":2}`)
	writeFile(t, filepath.Join(leftRoot, "note.txt"), "left\n")
	writeFile(t, filepath.Join(rightRoot, "note.txt"), "right\n")
	writeFile(t, filepath.Join(leftRoot, "left-only.txt"), "left only\n")

	svc := NewService()
	res, err := svc.CompareFolders(CompareFoldersRequest{
		LeftRoot:    leftRoot,
		RightRoot:   rightRoot,
		CurrentPath: "",
		Recursive:   true,
		ShowSame:    true,
	})
	if err != nil {
		t.Fatalf("CompareFolders() error = %v", err)
	}
	if res.Error != "" {
		t.Fatalf("CompareFolders() response error = %s", res.Error)
	}

	jsonItem := findFolderItem(t, res.Items, "payload.json")
	if jsonItem.CompareModeHint != "json" {
		t.Fatalf("payload.json hint = %s, want json", jsonItem.CompareModeHint)
	}
	textItem := findFolderItem(t, res.Items, "note.txt")
	if textItem.CompareModeHint != "text" {
		t.Fatalf("note.txt hint = %s, want text", textItem.CompareModeHint)
	}
	leftOnlyItem := findFolderItem(t, res.Items, "left-only.txt")
	if leftOnlyItem.CompareModeHint != "none" {
		t.Fatalf("left-only.txt hint = %s, want none", leftOnlyItem.CompareModeHint)
	}
}
