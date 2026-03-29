package desktopapi

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

const (
	desktopStateVersion = 1
	maxRecentEntries    = 10
)

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

	var decoded DesktopState
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return state, nil
	}
	return normalizeDesktopState(decoded), nil
}

func (s *desktopStateStore) Save(state DesktopState) error {
	normalized := normalizeDesktopState(state)

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
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

func defaultDesktopState() DesktopState {
	return DesktopState{
		Version:      desktopStateVersion,
		LastUsedMode: "json",
		JSON: DesktopJSONSession{
			Common: defaultJSONCompareCommon(),
		},
		Spec: DesktopSpecSession{
			Common: defaultSpecCompareCommon(),
		},
		Text: DesktopTextSession{
			Common:     defaultTextCompareCommon(),
			DiffLayout: "split",
		},
		Folder: DesktopFolderSession{
			ViewMode: "list",
		},
		Scenario: DesktopScenarioSession{
			ReportFormat: "text",
		},
	}
}

func normalizeDesktopState(state DesktopState) DesktopState {
	defaults := defaultDesktopState()

	state.Version = desktopStateVersion
	switch state.LastUsedMode {
	case "json", "spec", "text", "folder", "scenario":
	default:
		state.LastUsedMode = defaults.LastUsedMode
	}

	state.JSON.OldSourcePath = strings.TrimSpace(state.JSON.OldSourcePath)
	state.JSON.NewSourcePath = strings.TrimSpace(state.JSON.NewSourcePath)
	state.JSON.Common = normalizeCompareCommon(state.JSON.Common, defaultJSONCompareCommon())

	state.Spec.OldSourcePath = strings.TrimSpace(state.Spec.OldSourcePath)
	state.Spec.NewSourcePath = strings.TrimSpace(state.Spec.NewSourcePath)
	state.Spec.Common = normalizeCompareCommon(state.Spec.Common, defaultSpecCompareCommon())

	state.Text.OldSourcePath = strings.TrimSpace(state.Text.OldSourcePath)
	state.Text.NewSourcePath = strings.TrimSpace(state.Text.NewSourcePath)
	state.Text.Common = normalizeCompareCommon(state.Text.Common, defaultTextCompareCommon())
	if state.Text.DiffLayout != "split" && state.Text.DiffLayout != "unified" {
		state.Text.DiffLayout = defaults.Text.DiffLayout
	}

	state.Folder.LeftRoot = strings.TrimSpace(state.Folder.LeftRoot)
	state.Folder.RightRoot = strings.TrimSpace(state.Folder.RightRoot)
	state.Folder.CurrentPath = strings.TrimSpace(state.Folder.CurrentPath)
	if state.Folder.ViewMode != "list" && state.Folder.ViewMode != "tree" {
		state.Folder.ViewMode = defaults.Folder.ViewMode
	}

	state.Scenario.ScenarioPath = strings.TrimSpace(state.Scenario.ScenarioPath)
	if state.Scenario.ReportFormat != "text" && state.Scenario.ReportFormat != "json" {
		state.Scenario.ReportFormat = defaults.Scenario.ReportFormat
	}

	state.JSONRecentPairs = normalizeRecentPairs(state.JSONRecentPairs)
	state.SpecRecentPairs = normalizeRecentPairs(state.SpecRecentPairs)
	state.TextRecentPairs = normalizeRecentPairs(state.TextRecentPairs)
	state.FolderRecentPairs = normalizeRecentFolderPairs(state.FolderRecentPairs)
	state.ScenarioRecentPaths = normalizeRecentScenarioPaths(state.ScenarioRecentPaths)

	return state
}

func normalizeCompareCommon(common CompareCommon, defaults CompareCommon) CompareCommon {
	switch common.FailOn {
	case "none", "breaking", "any":
	default:
		common.FailOn = defaults.FailOn
	}
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
	common.NoColor = true

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

func normalizeRecentFolderPairs(input []DesktopRecentFolderPair) []DesktopRecentFolderPair {
	output := make([]DesktopRecentFolderPair, 0, len(input))
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

func normalizeRecentScenarioPaths(input []DesktopRecentScenarioPath) []DesktopRecentScenarioPath {
	output := make([]DesktopRecentScenarioPath, 0, len(input))
	seen := map[string]struct{}{}
	for _, item := range input {
		item.Path = strings.TrimSpace(item.Path)
		if item.Path == "" {
			continue
		}
		if item.ReportFormat != "text" && item.ReportFormat != "json" {
			item.ReportFormat = "text"
		}
		key := item.Path + "\x00" + item.ReportFormat
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
		FailOn:       "any",
		OutputFormat: "text",
		TextStyle:    "auto",
		IgnorePaths:  []string{},
		ShowPaths:    false,
		OnlyBreaking: false,
		NoColor:      true,
	}
}

func defaultSpecCompareCommon() CompareCommon {
	return CompareCommon{
		FailOn:       "any",
		OutputFormat: "text",
		TextStyle:    "semantic",
		IgnorePaths:  []string{},
		ShowPaths:    false,
		OnlyBreaking: false,
		NoColor:      true,
	}
}

func defaultTextCompareCommon() CompareCommon {
	return CompareCommon{
		FailOn:       "any",
		OutputFormat: "text",
		TextStyle:    "auto",
		IgnorePaths:  []string{},
		ShowPaths:    false,
		OnlyBreaking: false,
		NoColor:      true,
	}
}
