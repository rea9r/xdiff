package desktopapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	desktopStateVersion = 3
	maxRecentEntries    = 10
	defaultTabID        = "tab-1"
	defaultTabLabel     = "Tab 1"
)

type legacyDesktopState struct {
	Version              int                          `json:"version"`
	LastUsedMode         string                       `json:"lastUsedMode,omitempty"`
	JSON                 *DesktopJSONSession          `json:"json,omitempty"`
	Text                 *DesktopTextSession          `json:"text,omitempty"`
	Directory            *DesktopDirectorySession     `json:"directory,omitempty"`
	Tabs                 []DesktopTabSession          `json:"tabs,omitempty"`
	ActiveTabID          string                       `json:"activeTabId,omitempty"`
	JSONRecentPairs      []DesktopRecentPair          `json:"jsonRecentPairs"`
	TextRecentPairs      []DesktopRecentPair          `json:"textRecentPairs"`
	DirectoryRecentPairs []DesktopRecentDirectoryPair `json:"directoryRecentPairs"`

	LegacyDirectory            *DesktopDirectorySession     `json:"folder,omitempty"`
	LegacyDirectoryRecentPairs []DesktopRecentDirectoryPair `json:"folderRecentPairs,omitempty"`
}

type desktopStateStore struct {
	path string
}

func newDesktopStateStore() (*desktopStateStore, error) {
	path, err := defaultDesktopStatePath()
	if err != nil {
		return nil, err
	}
	return &desktopStateStore{path: path}, nil
}

func defaultDesktopStatePath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "xdiff", "desktop-state.json"), nil
}

func (s *desktopStateStore) Load() (DesktopState, error) {
	state := defaultDesktopState()
	raw, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return state, nil
		}
		return state, err
	}

	var legacy legacyDesktopState
	if err := json.Unmarshal(raw, &legacy); err != nil {
		return state, nil
	}

	decoded := upgradeLegacyDesktopState(legacy)
	return normalizeDesktopState(decoded), nil
}

func (s *desktopStateStore) Save(state DesktopState) error {
	normalized := normalizeDesktopState(state)

	if err := os.MkdirAll(filepath.Dir(s.path), 0o750); err != nil {
		return err
	}

	temp, err := os.CreateTemp(filepath.Dir(s.path), "desktop-state-*.tmp")
	if err != nil {
		return err
	}
	tempPath := temp.Name()

	encodeErr := func() error {
		encoder := json.NewEncoder(temp)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(normalized); err != nil {
			return err
		}
		if err := temp.Sync(); err != nil {
			return err
		}
		return nil
	}()

	closeErr := temp.Close()
	if encodeErr != nil {
		_ = os.Remove(tempPath)
		return encodeErr
	}
	if closeErr != nil {
		_ = os.Remove(tempPath)
		return closeErr
	}

	if err := os.Rename(tempPath, s.path); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	return nil
}

func upgradeLegacyDesktopState(legacy legacyDesktopState) DesktopState {
	if len(legacy.Tabs) > 0 {
		return DesktopState{
			Version:              legacy.Version,
			Tabs:                 legacy.Tabs,
			ActiveTabID:          legacy.ActiveTabID,
			JSONRecentPairs:      legacy.JSONRecentPairs,
			TextRecentPairs:      legacy.TextRecentPairs,
			DirectoryRecentPairs: legacy.DirectoryRecentPairs,
		}
	}

	mode := legacy.LastUsedMode
	if mode == "folder" {
		mode = "directory"
	}

	tab := DesktopTabSession{
		ID:           defaultTabID,
		Label:        defaultTabLabel,
		LastUsedMode: mode,
	}
	if legacy.JSON != nil {
		tab.JSON = *legacy.JSON
	}
	if legacy.Text != nil {
		tab.Text = *legacy.Text
	}
	if legacy.Directory != nil {
		tab.Directory = *legacy.Directory
	}
	if (tab.Directory == DesktopDirectorySession{}) && legacy.LegacyDirectory != nil {
		tab.Directory = *legacy.LegacyDirectory
	}

	directoryRecent := legacy.DirectoryRecentPairs
	if len(directoryRecent) == 0 && len(legacy.LegacyDirectoryRecentPairs) > 0 {
		directoryRecent = legacy.LegacyDirectoryRecentPairs
	}

	return DesktopState{
		Version:              desktopStateVersion,
		Tabs:                 []DesktopTabSession{tab},
		ActiveTabID:          tab.ID,
		JSONRecentPairs:      legacy.JSONRecentPairs,
		TextRecentPairs:      legacy.TextRecentPairs,
		DirectoryRecentPairs: directoryRecent,
	}
}

func defaultDesktopState() DesktopState {
	tab := defaultDesktopTabSession(defaultTabID, defaultTabLabel)
	return DesktopState{
		Version:     desktopStateVersion,
		Tabs:        []DesktopTabSession{tab},
		ActiveTabID: tab.ID,
	}
}

func defaultDesktopTabSession(id, label string) DesktopTabSession {
	return DesktopTabSession{
		ID:           id,
		Label:        label,
		LastUsedMode: "json",
		JSON: DesktopJSONSession{
			Common: defaultJSONCompareCommon(),
		},
		Text: DesktopTextSession{
			Common:     defaultTextCompareCommon(),
			DiffLayout: "split",
		},
		Directory: DesktopDirectorySession{
			ViewMode: "list",
		},
	}
}

func normalizeDesktopState(state DesktopState) DesktopState {
	state.Version = desktopStateVersion

	if len(state.Tabs) == 0 {
		state.Tabs = []DesktopTabSession{defaultDesktopTabSession(defaultTabID, defaultTabLabel)}
	}

	seenIDs := map[string]struct{}{}
	cleanedTabs := make([]DesktopTabSession, 0, len(state.Tabs))
	for i, tab := range state.Tabs {
		tab = normalizeTabSession(tab, i)
		if _, dup := seenIDs[tab.ID]; dup {
			tab.ID = fmt.Sprintf("%s-%d", tab.ID, i+1)
		}
		seenIDs[tab.ID] = struct{}{}
		cleanedTabs = append(cleanedTabs, tab)
	}
	state.Tabs = cleanedTabs

	state.ActiveTabID = strings.TrimSpace(state.ActiveTabID)
	if !tabIDExists(state.Tabs, state.ActiveTabID) {
		state.ActiveTabID = state.Tabs[0].ID
	}

	state.JSONRecentPairs = normalizeRecentPairs(state.JSONRecentPairs)
	state.TextRecentPairs = normalizeRecentPairs(state.TextRecentPairs)
	state.DirectoryRecentPairs = normalizeRecentDirectoryPairs(state.DirectoryRecentPairs)

	return state
}

func normalizeTabSession(tab DesktopTabSession, index int) DesktopTabSession {
	tab.ID = strings.TrimSpace(tab.ID)
	if tab.ID == "" {
		tab.ID = fmt.Sprintf("tab-%d", index+1)
	}
	tab.Label = strings.TrimSpace(tab.Label)
	if tab.Label == "" {
		tab.Label = fmt.Sprintf("Tab %d", index+1)
	}

	switch tab.LastUsedMode {
	case "json", "text", "directory":
	case "folder":
		tab.LastUsedMode = "directory"
	default:
		tab.LastUsedMode = "json"
	}

	tab.JSON.OldSourcePath = strings.TrimSpace(tab.JSON.OldSourcePath)
	tab.JSON.NewSourcePath = strings.TrimSpace(tab.JSON.NewSourcePath)
	tab.JSON.Common = normalizeCompareCommon(tab.JSON.Common, defaultJSONCompareCommon())

	tab.Text.OldSourcePath = strings.TrimSpace(tab.Text.OldSourcePath)
	tab.Text.NewSourcePath = strings.TrimSpace(tab.Text.NewSourcePath)
	tab.Text.Common = normalizeCompareCommon(tab.Text.Common, defaultTextCompareCommon())
	if tab.Text.DiffLayout != "split" && tab.Text.DiffLayout != "unified" {
		tab.Text.DiffLayout = "split"
	}

	tab.Directory.LeftRoot = strings.TrimSpace(tab.Directory.LeftRoot)
	tab.Directory.RightRoot = strings.TrimSpace(tab.Directory.RightRoot)
	tab.Directory.CurrentPath = strings.TrimSpace(tab.Directory.CurrentPath)
	if tab.Directory.ViewMode != "list" && tab.Directory.ViewMode != "tree" {
		tab.Directory.ViewMode = "list"
	}

	return tab
}

func tabIDExists(tabs []DesktopTabSession, id string) bool {
	if id == "" {
		return false
	}
	for _, t := range tabs {
		if t.ID == id {
			return true
		}
	}
	return false
}

func normalizeCompareCommon(common CompareCommon, defaults CompareCommon) CompareCommon {
	switch common.OutputFormat {
	case "text", "json":
	default:
		common.OutputFormat = defaults.OutputFormat
	}
	switch common.TextStyle {
	case "auto", "patch", "semantic":
	default:
		common.TextStyle = defaults.TextStyle
	}

	cleanIgnorePaths := make([]string, 0, len(common.IgnorePaths))
	for _, path := range common.IgnorePaths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		cleanIgnorePaths = append(cleanIgnorePaths, path)
	}
	common.IgnorePaths = cleanIgnorePaths

	return common
}

func normalizeRecentPairs(input []DesktopRecentPair) []DesktopRecentPair {
	output := make([]DesktopRecentPair, 0, len(input))
	seen := map[string]struct{}{}
	for _, item := range input {
		item.OldPath = strings.TrimSpace(item.OldPath)
		item.NewPath = strings.TrimSpace(item.NewPath)
		if item.OldPath == "" || item.NewPath == "" {
			continue
		}
		key := item.OldPath + "\x00" + item.NewPath
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		output = append(output, item)
		if len(output) >= maxRecentEntries {
			break
		}
	}
	return output
}

func normalizeRecentDirectoryPairs(input []DesktopRecentDirectoryPair) []DesktopRecentDirectoryPair {
	output := make([]DesktopRecentDirectoryPair, 0, len(input))
	seen := map[string]struct{}{}
	for _, item := range input {
		item.LeftRoot = strings.TrimSpace(item.LeftRoot)
		item.RightRoot = strings.TrimSpace(item.RightRoot)
		item.CurrentPath = strings.TrimSpace(item.CurrentPath)
		if item.LeftRoot == "" || item.RightRoot == "" {
			continue
		}
		if item.ViewMode != "list" && item.ViewMode != "tree" {
			item.ViewMode = "list"
		}
		key := item.LeftRoot + "\x00" + item.RightRoot + "\x00" + item.CurrentPath + "\x00" + item.ViewMode
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		output = append(output, item)
		if len(output) >= maxRecentEntries {
			break
		}
	}
	return output
}

func defaultJSONCompareCommon() CompareCommon {
	return CompareCommon{
		OutputFormat: "text",
		TextStyle:    "auto",
		IgnorePaths:  []string{},
		ShowPaths:    false,
	}
}

func defaultTextCompareCommon() CompareCommon {
	return CompareCommon{
		OutputFormat: "text",
		TextStyle:    "auto",
		IgnorePaths:  []string{},
		ShowPaths:    false,
	}
}
