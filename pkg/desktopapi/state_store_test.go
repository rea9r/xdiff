package desktopapi

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDesktopStateStoreLoadMissingFile(t *testing.T) {
	store := &desktopStateStore{
		path: filepath.Join(t.TempDir(), "missing", "desktop-state.json"),
	}

	state, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if state.Version != desktopStateVersion {
		t.Fatalf("version = %d, want %d", state.Version, desktopStateVersion)
	}
	if state.LastUsedMode != "json" {
		t.Fatalf("lastUsedMode = %q, want json", state.LastUsedMode)
	}
}

func TestDesktopStateStoreLoadMalformedJSONRecoverable(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "desktop-state.json")
	if err := os.WriteFile(path, []byte("{"), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	store := &desktopStateStore{path: path}
	state, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if state.Version != desktopStateVersion {
		t.Fatalf("version = %d, want %d", state.Version, desktopStateVersion)
	}
}

func TestDesktopStateStoreSaveLoadRoundtrip(t *testing.T) {
	store := &desktopStateStore{
		path: filepath.Join(t.TempDir(), "desktop-state.json"),
	}
	input := defaultDesktopState()
	input.LastUsedMode = "spec"
	input.Folder.LeftRoot = "/tmp/left"
	input.Folder.RightRoot = "/tmp/right"
	input.Folder.ViewMode = "tree"
	input.Scenario.ScenarioPath = "/tmp/xdiff.yaml"
	input.JSONRecentPairs = []DesktopRecentPair{
		{OldPath: "/a.json", NewPath: "/b.json", UsedAt: "2026-01-01T00:00:00Z"},
	}

	if err := store.Save(input); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	loaded, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if loaded.LastUsedMode != "spec" {
		t.Fatalf("lastUsedMode = %q, want spec", loaded.LastUsedMode)
	}
	if loaded.Folder.LeftRoot != "/tmp/left" || loaded.Folder.RightRoot != "/tmp/right" {
		t.Fatalf("folder roots mismatch: %+v", loaded.Folder)
	}
	if loaded.Folder.ViewMode != "tree" {
		t.Fatalf("folder viewMode = %q, want tree", loaded.Folder.ViewMode)
	}
	if len(loaded.JSONRecentPairs) != 1 {
		t.Fatalf("jsonRecentPairs len = %d, want 1", len(loaded.JSONRecentPairs))
	}
}

func TestNormalizeDesktopStateRecentDedupeAndMax10(t *testing.T) {
	input := defaultDesktopState()
	input.JSONRecentPairs = []DesktopRecentPair{
		{OldPath: " /a ", NewPath: " /b ", UsedAt: "1"},
		{OldPath: "/a", NewPath: "/b", UsedAt: "2"},
	}
	for i := 0; i < 20; i++ {
		input.TextRecentPairs = append(input.TextRecentPairs, DesktopRecentPair{
			OldPath: "/old/" + string(rune('a'+i)),
			NewPath: "/new/" + string(rune('a'+i)),
			UsedAt:  "2026-01-01T00:00:00Z",
		})
	}

	normalized := normalizeDesktopState(input)
	if len(normalized.JSONRecentPairs) != 1 {
		t.Fatalf("jsonRecentPairs len = %d, want 1", len(normalized.JSONRecentPairs))
	}
	if len(normalized.TextRecentPairs) != maxRecentEntries {
		t.Fatalf("textRecentPairs len = %d, want %d", len(normalized.TextRecentPairs), maxRecentEntries)
	}
}

func TestNormalizeDesktopStateEnumFallback(t *testing.T) {
	input := defaultDesktopState()
	input.LastUsedMode = "unknown"
	input.Text.DiffLayout = "grid"
	input.Folder.ViewMode = "matrix"
	input.Scenario.ReportFormat = "xml"
	input.JSON.Common.OutputFormat = "yaml"
	input.JSON.Common.TextStyle = "invalid"
	input.JSON.Common.FailOn = "wat"
	input.JSON.Common.IgnorePaths = []string{"", "  ", "a.b"}
	input.FolderRecentPairs = []DesktopRecentFolderPair{
		{LeftRoot: " /left ", RightRoot: " /right ", CurrentPath: " /api ", ViewMode: "x"},
	}

	normalized := normalizeDesktopState(input)

	if normalized.LastUsedMode != "json" {
		t.Fatalf("lastUsedMode = %q, want json", normalized.LastUsedMode)
	}
	if normalized.Text.DiffLayout != "split" {
		t.Fatalf("diffLayout = %q, want split", normalized.Text.DiffLayout)
	}
	if normalized.Folder.ViewMode != "list" {
		t.Fatalf("folder.viewMode = %q, want list", normalized.Folder.ViewMode)
	}
	if normalized.Scenario.ReportFormat != "text" {
		t.Fatalf("scenario.reportFormat = %q, want text", normalized.Scenario.ReportFormat)
	}
	if normalized.JSON.Common.OutputFormat != "text" {
		t.Fatalf("json.common.outputFormat = %q, want text", normalized.JSON.Common.OutputFormat)
	}
	if normalized.JSON.Common.TextStyle != "auto" {
		t.Fatalf("json.common.textStyle = %q, want auto", normalized.JSON.Common.TextStyle)
	}
	if normalized.JSON.Common.FailOn != "any" {
		t.Fatalf("json.common.failOn = %q, want any", normalized.JSON.Common.FailOn)
	}
	if len(normalized.JSON.Common.IgnorePaths) != 1 || normalized.JSON.Common.IgnorePaths[0] != "a.b" {
		t.Fatalf("json.common.ignorePaths = %+v, want [a.b]", normalized.JSON.Common.IgnorePaths)
	}
	if len(normalized.FolderRecentPairs) != 1 {
		t.Fatalf("folderRecentPairs len = %d, want 1", len(normalized.FolderRecentPairs))
	}
	if normalized.FolderRecentPairs[0].ViewMode != "list" {
		t.Fatalf("folderRecentPairs[0].viewMode = %q, want list", normalized.FolderRecentPairs[0].ViewMode)
	}
	if normalized.FolderRecentPairs[0].LeftRoot != "/left" ||
		normalized.FolderRecentPairs[0].RightRoot != "/right" ||
		normalized.FolderRecentPairs[0].CurrentPath != "/api" {
		t.Fatalf("folderRecentPairs[0] trim mismatch: %+v", normalized.FolderRecentPairs[0])
	}
}
