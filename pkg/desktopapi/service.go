package desktopapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/rea9r/xdiff/internal/openapi"
	"github.com/rea9r/xdiff/internal/output"
	"github.com/rea9r/xdiff/internal/runner"
	"github.com/rea9r/xdiff/internal/scenario"
	"github.com/rea9r/xdiff/internal/source"
)

type Service struct{}

type folderEntrySnapshot struct {
	Path string
	Kind string
	Size int64
	Err  error
}

func NewService() *Service {
	return &Service{}
}

func guiUseColor() bool {
	return false
}

func (s *Service) CompareJSONFiles(req CompareJSONRequest) (*CompareResponse, error) {
	opts := runner.Options{
		Format:       normalizeOutputFormat(req.Common.OutputFormat),
		FailOn:       req.Common.FailOn,
		IgnorePaths:  append([]string(nil), req.Common.IgnorePaths...),
		ShowPaths:    req.Common.ShowPaths,
		OnlyBreaking: req.Common.OnlyBreaking,
		TextStyle:    req.Common.TextStyle,
		IgnoreOrder:  req.IgnoreOrder,
		UseColor:     guiUseColor(),
		OldPath:      req.OldPath,
		NewPath:      req.NewPath,
	}

	res := runner.RunJSONFilesDetailed(opts)
	return &CompareResponse{
		ExitCode:  res.ExitCode,
		DiffFound: res.DiffFound,
		Output:    res.Output,
		Error:     errString(res.Err),
	}, nil
}

type jsonMachineDiffItem struct {
	Type     string `json:"type"`
	Path     string `json:"path"`
	OldValue any    `json:"old_value,omitempty"`
	NewValue any    `json:"new_value,omitempty"`
}

type jsonMachineResult struct {
	Diffs []jsonMachineDiffItem `json:"diffs"`
}

func (s *Service) CompareJSONRich(req CompareJSONRequest) (*CompareJSONRichResponse, error) {
	rawResult, err := s.CompareJSONFiles(req)
	if err != nil {
		return nil, err
	}

	structuredReq := req
	structuredReq.Common.OutputFormat = output.JSONFormat
	structuredReq.Common.ShowPaths = false
	structuredReq.Common.NoColor = true

	structuredResult, err := s.CompareJSONFiles(structuredReq)
	if err != nil {
		return nil, err
	}

	diffs := make([]JSONRichDiffItem, 0)
	if strings.TrimSpace(structuredResult.Output) != "" {
		var parsed jsonMachineResult
		if err := json.Unmarshal([]byte(structuredResult.Output), &parsed); err != nil {
			return nil, fmt.Errorf("failed to parse structured JSON diff output: %w", err)
		}

		diffs = make([]JSONRichDiffItem, 0, len(parsed.Diffs))
		for _, item := range parsed.Diffs {
			breaking := item.Type == "removed" || item.Type == "type_changed"
			diffs = append(diffs, JSONRichDiffItem{
				Type:     item.Type,
				Path:     item.Path,
				OldValue: item.OldValue,
				NewValue: item.NewValue,
				Breaking: breaking,
			})
		}
	}

	return &CompareJSONRichResponse{
		Result:  *rawResult,
		Summary: summarizeJSONRichDiffs(diffs),
		Diffs:   diffs,
	}, nil
}

func summarizeJSONRichDiffs(diffs []JSONRichDiffItem) JSONRichSummary {
	summary := JSONRichSummary{}
	for _, diff := range diffs {
		switch diff.Type {
		case "added":
			summary.Added++
		case "removed":
			summary.Removed++
		case "changed":
			summary.Changed++
		case "type_changed":
			summary.TypeChanged++
		}

		if diff.Breaking {
			summary.Breaking++
		}
	}

	return summary
}

func (s *Service) CompareSpecFiles(req CompareSpecRequest) (*CompareResponse, error) {
	oldSpec, err := source.LoadOpenAPISpecFile(req.OldPath)
	if err != nil {
		return &CompareResponse{ExitCode: 2, Error: err.Error()}, nil
	}
	newSpec, err := source.LoadOpenAPISpecFile(req.NewPath)
	if err != nil {
		return &CompareResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	diffs := openapi.ComparePathsMethods(oldSpec, newSpec)
	opts := runner.CompareOptions{
		Format:        normalizeOutputFormat(req.Common.OutputFormat),
		FailOn:        req.Common.FailOn,
		IgnorePaths:   append([]string(nil), req.Common.IgnorePaths...),
		ShowPaths:     req.Common.ShowPaths,
		OnlyBreaking:  req.Common.OnlyBreaking,
		TextStyle:     req.Common.TextStyle,
		UseColor:      guiUseColor(),
		PathFormatter: openapi.HumanizePath,
	}

	res := runner.RunDeltaDiffsDetailed(diffs, opts)
	return &CompareResponse{
		ExitCode:  res.ExitCode,
		DiffFound: res.DiffFound,
		Output:    res.Output,
		Error:     errString(res.Err),
	}, nil
}

func (s *Service) CompareText(req CompareTextRequest) (*CompareResponse, error) {
	opts := runner.CompareOptions{
		Format:       normalizeOutputFormat(req.Common.OutputFormat),
		FailOn:       req.Common.FailOn,
		IgnorePaths:  append([]string(nil), req.Common.IgnorePaths...),
		ShowPaths:    req.Common.ShowPaths,
		OnlyBreaking: req.Common.OnlyBreaking,
		TextStyle:    req.Common.TextStyle,
		UseColor:     guiUseColor(),
	}

	res := runner.RunTextValuesDetailed(req.OldText, req.NewText, opts)
	return &CompareResponse{
		ExitCode:  res.ExitCode,
		DiffFound: res.DiffFound,
		Output:    res.Output,
		Error:     errString(res.Err),
	}, nil
}

func (s *Service) LoadTextFile(req LoadTextFileRequest) (*LoadTextFileResponse, error) {
	path := strings.TrimSpace(req.Path)
	if path == "" {
		return nil, fmt.Errorf("path is required")
	}

	body, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	if !utf8.Valid(body) {
		return nil, fmt.Errorf("selected file is not valid UTF-8 text: %s", path)
	}

	return &LoadTextFileResponse{
		Path:    path,
		Content: string(body),
	}, nil
}

func (s *Service) CompareFolders(req CompareFoldersRequest) (*CompareFoldersResponse, error) {
	leftRoot := strings.TrimSpace(req.LeftRoot)
	rightRoot := strings.TrimSpace(req.RightRoot)
	if leftRoot == "" || rightRoot == "" {
		return &CompareFoldersResponse{
			Error: "leftRoot and rightRoot are required",
		}, nil
	}

	leftInfo, err := os.Stat(leftRoot)
	if err != nil {
		return &CompareFoldersResponse{Error: fmt.Sprintf("left root error: %v", err)}, nil
	}
	rightInfo, err := os.Stat(rightRoot)
	if err != nil {
		return &CompareFoldersResponse{Error: fmt.Sprintf("right root error: %v", err)}, nil
	}
	if !leftInfo.IsDir() || !rightInfo.IsDir() {
		return &CompareFoldersResponse{
			Error: "both leftRoot and rightRoot must be directories",
		}, nil
	}

	leftEntries, err := collectFolderEntries(leftRoot, req.Recursive)
	if err != nil {
		return &CompareFoldersResponse{Error: fmt.Sprintf("left root walk error: %v", err)}, nil
	}
	rightEntries, err := collectFolderEntries(rightRoot, req.Recursive)
	if err != nil {
		return &CompareFoldersResponse{Error: fmt.Sprintf("right root walk error: %v", err)}, nil
	}

	keys := collectFolderKeys(leftEntries, rightEntries)
	nameFilter := strings.ToLower(strings.TrimSpace(req.NameFilter))

	resp := &CompareFoldersResponse{
		Summary: FolderCompareSummary{},
		Entries: make([]FolderCompareEntry, 0, len(keys)),
	}

	for _, rel := range keys {
		left, leftOK := leftEntries[rel]
		right, rightOK := rightEntries[rel]

		entry := FolderCompareEntry{
			RelativePath: rel,
			LeftExists:   leftOK,
			RightExists:  rightOK,
			LeftKind:     "missing",
			RightKind:    "missing",
			LeftPath:     "",
			RightPath:    "",
			LeftSize:     0,
			RightSize:    0,
			Status:       "error",
		}
		if leftOK {
			entry.LeftPath = left.Path
			entry.LeftKind = left.Kind
			entry.LeftSize = left.Size
		}
		if rightOK {
			entry.RightPath = right.Path
			entry.RightKind = right.Kind
			entry.RightSize = right.Size
		}

		switch {
		case leftOK && left.Err != nil:
			entry.Status = "error"
			entry.Message = left.Err.Error()
		case rightOK && right.Err != nil:
			entry.Status = "error"
			entry.Message = right.Err.Error()
		case !leftOK:
			entry.Status = "right-only"
		case !rightOK:
			entry.Status = "left-only"
		case left.Kind != right.Kind:
			entry.Status = "type-mismatch"
		case left.Kind == "dir":
			entry.Status = "same"
		case left.Kind == "file":
			if left.Size != right.Size {
				entry.Status = "changed"
			} else {
				equal, cmpErr := compareFileContents(left.Path, right.Path)
				if cmpErr != nil {
					entry.Status = "error"
					entry.Message = cmpErr.Error()
				} else if equal {
					entry.Status = "same"
				} else {
					entry.Status = "changed"
				}
			}
		default:
			entry.Status = "error"
			entry.Message = "unsupported file kind"
		}

		entry.CompareModeHint = inferCompareModeHint(
			entry.RelativePath,
			entry.Status,
			entry.LeftKind,
			entry.RightKind,
		)

		if !req.ShowSame && entry.Status == "same" {
			continue
		}
		if nameFilter != "" && !strings.Contains(strings.ToLower(entry.RelativePath), nameFilter) {
			continue
		}

		resp.Entries = append(resp.Entries, entry)
		addFolderSummary(&resp.Summary, entry.Status)
	}

	return resp, nil
}

func (s *Service) RunScenario(req RunScenarioRequest) (*ScenarioRunResponse, error) {
	cfg, err := scenario.LoadFile(req.ScenarioPath)
	if err != nil {
		return &ScenarioRunResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	checks, err := scenario.Resolve(cfg, req.ScenarioPath)
	if err != nil {
		return &ScenarioRunResponse{ExitCode: 2, Error: err.Error()}, nil
	}
	checks, err = scenario.FilterResolvedChecks(checks, req.Only)
	if err != nil {
		return &ScenarioRunResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	summary, results := scenario.RunResolved(checks)
	out, err := renderScenarioReport(req.ReportFormat, summary, results, req.ScenarioPath)
	if err != nil {
		return &ScenarioRunResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	return &ScenarioRunResponse{
		ExitCode: summary.ExitCode,
		Summary: &ScenarioSummary{
			Total:    summary.Total,
			OK:       summary.OK,
			Diff:     summary.Diff,
			Error:    summary.Error,
			ExitCode: summary.ExitCode,
		},
		Results: mapScenarioResults(results),
		Output:  out,
	}, nil
}

func (s *Service) ListScenarioChecks(req ListScenarioChecksRequest) (*ScenarioListResponse, error) {
	cfg, err := scenario.LoadFile(req.ScenarioPath)
	if err != nil {
		return &ScenarioListResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	checks, err := scenario.Resolve(cfg, req.ScenarioPath)
	if err != nil {
		return &ScenarioListResponse{ExitCode: 2, Error: err.Error()}, nil
	}
	checks, err = scenario.FilterResolvedChecks(checks, req.Only)
	if err != nil {
		return &ScenarioListResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	entries := scenario.BuildCheckListEntries(checks, req.ScenarioPath)
	mapped := make([]ScenarioCheckListEntry, 0, len(entries))
	for _, e := range entries {
		mapped = append(mapped, ScenarioCheckListEntry{
			Name:    e.Name,
			Kind:    e.Kind,
			Old:     e.Old,
			New:     e.New,
			Summary: e.Summary,
		})
	}

	out, err := renderScenarioList(req.ReportFormat, checks, req.ScenarioPath)
	if err != nil {
		return &ScenarioListResponse{ExitCode: 2, Error: err.Error()}, nil
	}

	return &ScenarioListResponse{
		ExitCode: 0,
		Checks:   mapped,
		Output:   out,
	}, nil
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func normalizeOutputFormat(v string) string {
	if v == "" {
		return output.TextFormat
	}
	return v
}

func renderScenarioReport(format string, summary scenario.Summary, results []scenario.Result, scenarioPath string) (string, error) {
	switch format {
	case "", output.TextFormat:
		return scenario.RenderText(summary, results, scenarioPath), nil
	case output.JSONFormat:
		return scenario.RenderJSON(summary, results)
	default:
		return "", fmt.Errorf("invalid report format %q (allowed: text, json)", format)
	}
}

func renderScenarioList(format string, checks []scenario.ResolvedCheck, scenarioPath string) (string, error) {
	switch format {
	case "", output.TextFormat:
		return scenario.RenderCheckListText(checks, scenarioPath), nil
	case output.JSONFormat:
		return scenario.RenderCheckListJSON(checks, scenarioPath)
	default:
		return "", fmt.Errorf("invalid report format %q (allowed: text, json)", format)
	}
}

func mapScenarioResults(in []scenario.Result) []ScenarioResult {
	out := make([]ScenarioResult, 0, len(in))
	for _, r := range in {
		out = append(out, ScenarioResult{
			Name:         r.Name,
			Kind:         r.Kind,
			Status:       r.Status,
			ExitCode:     r.ExitCode,
			DiffFound:    r.DiffFound,
			Output:       r.Output,
			ErrorMessage: r.ErrorMessage,
		})
	}
	return out
}

func collectFolderEntries(root string, recursive bool) (map[string]folderEntrySnapshot, error) {
	out := make(map[string]folderEntrySnapshot)
	if recursive {
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if path == root {
				return nil
			}
			rel, relErr := filepath.Rel(root, path)
			if relErr != nil {
				return nil
			}
			rel = filepath.ToSlash(rel)

			if err != nil {
				out[rel] = folderEntrySnapshot{
					Path: path,
					Kind: "unknown",
					Err:  err,
				}
				return nil
			}

			kind, size, kindErr := classifyFolderPath(path)
			out[rel] = folderEntrySnapshot{
				Path: path,
				Kind: kind,
				Size: size,
				Err:  kindErr,
			}
			return nil
		})
		return out, err
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}

	for _, d := range entries {
		path := filepath.Join(root, d.Name())
		kind, size, kindErr := classifyFolderPath(path)
		out[filepath.ToSlash(d.Name())] = folderEntrySnapshot{
			Path: path,
			Kind: kind,
			Size: size,
			Err:  kindErr,
		}
	}
	return out, nil
}

func collectFolderKeys(
	leftEntries map[string]folderEntrySnapshot,
	rightEntries map[string]folderEntrySnapshot,
) []string {
	keySet := make(map[string]struct{}, len(leftEntries)+len(rightEntries))
	for key := range leftEntries {
		keySet[key] = struct{}{}
	}
	for key := range rightEntries {
		keySet[key] = struct{}{}
	}

	keys := make([]string, 0, len(keySet))
	for key := range keySet {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func classifyFolderPath(path string) (string, int64, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return "unknown", 0, err
	}
	if info.IsDir() {
		return "dir", 0, nil
	}
	if info.Mode().IsRegular() {
		return "file", info.Size(), nil
	}
	return "unknown", 0, nil
}

func compareFileContents(leftPath, rightPath string) (_ bool, err error) {
	left, err := os.Open(leftPath)
	if err != nil {
		return false, err
	}
	defer func() {
		if cerr := left.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	right, err := os.Open(rightPath)
	if err != nil {
		return false, err
	}
	defer func() {
		if cerr := right.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	leftBuf := make([]byte, 32*1024)
	rightBuf := make([]byte, 32*1024)

	for {
		leftN, leftErr := left.Read(leftBuf)
		rightN, rightErr := right.Read(rightBuf)

		if leftN != rightN {
			return false, nil
		}
		if !bytes.Equal(leftBuf[:leftN], rightBuf[:rightN]) {
			return false, nil
		}

		if leftErr == io.EOF && rightErr == io.EOF {
			return true, nil
		}
		if leftErr != nil && leftErr != io.EOF {
			return false, leftErr
		}
		if rightErr != nil && rightErr != io.EOF {
			return false, rightErr
		}
	}
}

func inferCompareModeHint(relativePath, status, leftKind, rightKind string) string {
	if status != "same" && status != "changed" {
		return "none"
	}
	if leftKind != "file" || rightKind != "file" {
		return "none"
	}

	lowerPath := strings.ToLower(relativePath)
	ext := strings.ToLower(filepath.Ext(relativePath))
	isSpecExt := ext == ".yaml" || ext == ".yml" || ext == ".json"
	if isSpecExt && (strings.Contains(lowerPath, "openapi") || strings.Contains(lowerPath, "swagger")) {
		return "spec"
	}
	if ext == ".json" {
		return "json"
	}
	return "text"
}

func addFolderSummary(summary *FolderCompareSummary, status string) {
	summary.Total++
	switch status {
	case "same":
		summary.Same++
	case "changed":
		summary.Changed++
	case "left-only":
		summary.LeftOnly++
	case "right-only":
		summary.RightOnly++
	case "type-mismatch":
		summary.TypeMismatch++
	case "error":
		summary.Error++
	default:
		summary.Error++
	}
}
