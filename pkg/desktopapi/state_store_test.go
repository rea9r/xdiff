package desktopapi

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
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
	if len(state.Tabs) != 1 {
		t.Fatalf("tabs len = %d, want 1", len(state.Tabs))
	}
	if state.Tabs[0].LastUsedMode != "json" {
		t.Fatalf("tabs[0].lastUsedMode = %q, want json", state.Tabs[0].LastUsedMode)
	}
	if state.ActiveTabID != state.Tabs[0].ID {
		t.Fatalf("activeTabId = %q, want %q", state.ActiveTabID, state.Tabs[0].ID)
	}
}

func TestDesktopStateStoreLoadMalformedJSONRecoverable(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "desktop-state.json")
	if err := os.WriteFile(path, []byte("{"), 0o600); err != nil {
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
	if len(state.Tabs) != 1 {
		t.Fatalf("tabs len = %d, want 1", len(state.Tabs))
	}
}

func TestDesktopStateStoreSaveLoadRoundtrip(t *testing.T) {
	store := &desktopStateStore{
		path: filepath.Join(t.TempDir(), "desktop-state.json"),
	}
	input := defaultDesktopState()
	tab := input.Tabs[0]
	tab.LastUsedMode = "text"
	tab.Directory.LeftRoot = "/tmp/left"
	tab.Directory.RightRoot = "/tmp/right"
	tab.Directory.ViewMode = "tree"
	input.Tabs[0] = tab
	input.Tabs = append(input.Tabs, DesktopTabSession{
		ID:           "tab-2",
		Label:        "Tab 2",
		LastUsedMode: "json",
	})
	input.ActiveTabID = "tab-2"
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
	if len(loaded.Tabs) != 2 {
		t.Fatalf("tabs len = %d, want 2", len(loaded.Tabs))
	}
	if loaded.ActiveTabID != "tab-2" {
		t.Fatalf("activeTabId = %q, want tab-2", loaded.ActiveTabID)
	}
	if loaded.Tabs[0].LastUsedMode != "text" {
		t.Fatalf("tabs[0].lastUsedMode = %q, want text", loaded.Tabs[0].LastUsedMode)
	}
	if loaded.Tabs[0].Directory.LeftRoot != "/tmp/left" || loaded.Tabs[0].Directory.RightRoot != "/tmp/right" {
		t.Fatalf("tabs[0].directory mismatch: %+v", loaded.Tabs[0].Directory)
	}
	if loaded.Tabs[0].Directory.ViewMode != "tree" {
		t.Fatalf("tabs[0].directory.viewMode = %q, want tree", loaded.Tabs[0].Directory.ViewMode)
	}
	if len(loaded.JSONRecentPairs) != 1 {
		t.Fatalf("jsonRecentPairs len = %d, want 1", len(loaded.JSONRecentPairs))
	}
}

func TestDesktopStateStoreLoadLegacyFolderKeys(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "desktop-state.json")
	legacyJSON := `{
		"version": 1,
		"lastUsedMode": "folder",
		"folder": {
			"leftRoot": "/legacy/left",
			"rightRoot": "/legacy/right",
			"currentPath": "api",
			"viewMode": "tree"
		},
		"folderRecentPairs": [
			{"leftRoot": "/r1/left", "rightRoot": "/r1/right", "currentPath": "", "viewMode": "list", "usedAt": "2026-01-01T00:00:00Z"}
		]
	}`
	if err := os.WriteFile(path, []byte(legacyJSON), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	store := &desktopStateStore{path: path}
	state, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if len(state.Tabs) != 1 {
		t.Fatalf("tabs len = %d, want 1", len(state.Tabs))
	}
	tab := state.Tabs[0]
	if tab.LastUsedMode != "directory" {
		t.Fatalf("tab.lastUsedMode = %q, want directory", tab.LastUsedMode)
	}
	if tab.Directory.LeftRoot != "/legacy/left" || tab.Directory.RightRoot != "/legacy/right" {
		t.Fatalf("legacy folder roots not migrated: %+v", tab.Directory)
	}
	if tab.Directory.CurrentPath != "api" || tab.Directory.ViewMode != "tree" {
		t.Fatalf("legacy folder fields not migrated: %+v", tab.Directory)
	}
	if len(state.DirectoryRecentPairs) != 1 || state.DirectoryRecentPairs[0].LeftRoot != "/r1/left" {
		t.Fatalf("legacy folderRecentPairs not migrated: %+v", state.DirectoryRecentPairs)
	}
	if state.Version != desktopStateVersion {
		t.Fatalf("version = %d, want %d", state.Version, desktopStateVersion)
	}
}

func TestDesktopStateStoreLoadV2InlineSession(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "desktop-state.json")
	v2JSON := `{
		"version": 2,
		"lastUsedMode": "json",
		"json": {"oldSourcePath": "/old.json", "newSourcePath": "/new.json", "ignoreOrder": true, "common": {"outputFormat": "text", "textStyle": "auto", "ignorePaths": []}},
		"text": {"oldSourcePath": "", "newSourcePath": "", "common": {"outputFormat": "text", "textStyle": "auto", "ignorePaths": []}, "diffLayout": "split"},
		"directory": {"leftRoot": "", "rightRoot": "", "currentPath": "", "viewMode": "list"},
		"jsonRecentPairs": [{"oldPath": "/a.json", "newPath": "/b.json", "usedAt": "2026-01-01T00:00:00Z"}],
		"textRecentPairs": [],
		"directoryRecentPairs": []
	}`
	if err := os.WriteFile(path, []byte(v2JSON), 0o600); err != nil {
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
	if len(state.Tabs) != 1 {
		t.Fatalf("tabs len = %d, want 1", len(state.Tabs))
	}
	tab := state.Tabs[0]
	if tab.ID == "" {
		t.Fatalf("tab.id is empty")
	}
	if tab.LastUsedMode != "json" {
		t.Fatalf("tab.lastUsedMode = %q, want json", tab.LastUsedMode)
	}
	if tab.JSON.OldSourcePath != "/old.json" || tab.JSON.NewSourcePath != "/new.json" {
		t.Fatalf("tab.json paths not migrated: %+v", tab.JSON)
	}
	if !tab.JSON.IgnoreOrder {
		t.Fatalf("tab.json.ignoreOrder = false, want true")
	}
	if state.ActiveTabID != tab.ID {
		t.Fatalf("activeTabId = %q, want %q", state.ActiveTabID, tab.ID)
	}
	if len(state.JSONRecentPairs) != 1 {
		t.Fatalf("jsonRecentPairs len = %d, want 1", len(state.JSONRecentPairs))
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
	tab := input.Tabs[0]
	tab.LastUsedMode = "unknown"
	tab.Text.DiffLayout = "grid"
	tab.Directory.ViewMode = "matrix"
	tab.JSON.Common.OutputFormat = "yaml"
	tab.JSON.Common.TextStyle = "invalid"
	tab.JSON.Common.IgnorePaths = []string{"", "  ", "a.b"}
	input.Tabs[0] = tab
	input.DirectoryRecentPairs = []DesktopRecentDirectoryPair{
		{LeftRoot: " /left ", RightRoot: " /right ", CurrentPath: " /api ", ViewMode: "x"},
	}

	normalized := normalizeDesktopState(input)

	got := normalized.Tabs[0]
	if got.LastUsedMode != "json" {
		t.Fatalf("lastUsedMode = %q, want json", got.LastUsedMode)
	}
	if got.Text.DiffLayout != "split" {
		t.Fatalf("diffLayout = %q, want split", got.Text.DiffLayout)
	}
	if got.Directory.ViewMode != "list" {
		t.Fatalf("directory.viewMode = %q, want list", got.Directory.ViewMode)
	}
	if got.JSON.Common.OutputFormat != "text" {
		t.Fatalf("json.common.outputFormat = %q, want text", got.JSON.Common.OutputFormat)
	}
	if got.JSON.Common.TextStyle != "auto" {
		t.Fatalf("json.common.textStyle = %q, want auto", got.JSON.Common.TextStyle)
	}
	if len(got.JSON.Common.IgnorePaths) != 1 || got.JSON.Common.IgnorePaths[0] != "a.b" {
		t.Fatalf("json.common.ignorePaths = %+v, want [a.b]", got.JSON.Common.IgnorePaths)
	}
	if len(normalized.DirectoryRecentPairs) != 1 {
		t.Fatalf("directoryRecentPairs len = %d, want 1", len(normalized.DirectoryRecentPairs))
	}
	if normalized.DirectoryRecentPairs[0].ViewMode != "list" {
		t.Fatalf("directoryRecentPairs[0].viewMode = %q, want list", normalized.DirectoryRecentPairs[0].ViewMode)
	}
	if normalized.DirectoryRecentPairs[0].LeftRoot != "/left" ||
		normalized.DirectoryRecentPairs[0].RightRoot != "/right" ||
		normalized.DirectoryRecentPairs[0].CurrentPath != "/api" {
		t.Fatalf("directoryRecentPairs[0] trim mismatch: %+v", normalized.DirectoryRecentPairs[0])
	}
}

func TestNormalizeDesktopStateActiveTabIDFallback(t *testing.T) {
	input := defaultDesktopState()
	input.ActiveTabID = "nonexistent"

	normalized := normalizeDesktopState(input)
	if normalized.ActiveTabID != normalized.Tabs[0].ID {
		t.Fatalf("activeTabId = %q, want %q", normalized.ActiveTabID, normalized.Tabs[0].ID)
	}
}

func TestNormalizeDesktopStateAddsDefaultTabWhenEmpty(t *testing.T) {
	state := DesktopState{Version: desktopStateVersion}

	normalized := normalizeDesktopState(state)
	if len(normalized.Tabs) != 1 {
		t.Fatalf("tabs len = %d, want 1", len(normalized.Tabs))
	}
	if normalized.ActiveTabID != normalized.Tabs[0].ID {
		t.Fatalf("activeTabId = %q, want %q", normalized.ActiveTabID, normalized.Tabs[0].ID)
	}
}

func TestNormalizeDesktopStateDuplicateTabIDs(t *testing.T) {
	state := DesktopState{
		Version: desktopStateVersion,
		Tabs: []DesktopTabSession{
			{ID: "tab-1", Label: "First"},
			{ID: "tab-1", Label: "Second"},
		},
		ActiveTabID: "tab-1",
	}

	normalized := normalizeDesktopState(state)
	if normalized.Tabs[0].ID == normalized.Tabs[1].ID {
		t.Fatalf("duplicate tab ids not deduped: %+v", normalized.Tabs)
	}
}

func TestServiceStateConcurrentAccess(t *testing.T) {
	dir := t.TempDir()
	store := &desktopStateStore{
		path: filepath.Join(dir, "desktop-state.json"),
	}
	svc := &Service{stateStore: store}

	initial := defaultDesktopState()
	if err := svc.SaveDesktopState(initial); err != nil {
		t.Fatalf("initial Save() error = %v", err)
	}

	const goroutines = 20
	var wg sync.WaitGroup
	wg.Add(goroutines)

	for i := 0; i < goroutines; i++ {
		go func(n int) {
			defer wg.Done()
			if n%2 == 0 {
				state := defaultDesktopState()
				state.Tabs[0].Directory.LeftRoot = fmt.Sprintf("/tmp/left-%d", n)
				if err := svc.SaveDesktopState(state); err != nil {
					t.Errorf("goroutine %d: Save() error = %v", n, err)
				}
			} else {
				loaded, err := svc.LoadDesktopState()
				if err != nil {
					t.Errorf("goroutine %d: Load() error = %v", n, err)
				}
				if loaded == nil {
					t.Errorf("goroutine %d: Load() returned nil", n)
				}
			}
		}(i)
	}

	wg.Wait()
}
