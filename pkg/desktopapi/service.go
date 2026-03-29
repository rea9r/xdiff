package desktopapi

import (
	"bytes"
	"encoding/json"
	"errors"
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
	"sigs.k8s.io/yaml"
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

	diffs, err := parseJSONMachineDiffs(structuredResult.Output)
	if err != nil {
		return nil, err
	}

	return &CompareJSONRichResponse{
		Result:  *rawResult,
		Summary: summarizeJSONRichDiffs(diffs),
		Diffs:   diffs,
	}, nil
}

func (s *Service) CompareJSONValuesRich(req CompareJSONValuesRequest) (*CompareJSONRichResponse, error) {
	var oldValue any
	if err := json.Unmarshal([]byte(req.OldValue), &oldValue); err != nil {
		return nil, fmt.Errorf("invalid old JSON: %w", err)
	}

	var newValue any
	if err := json.Unmarshal([]byte(req.NewValue), &newValue); err != nil {
		return nil, fmt.Errorf("invalid new JSON: %w", err)
	}

	rawOpts := runner.CompareOptions{
		Format:       normalizeOutputFormat(req.Common.OutputFormat),
		FailOn:       req.Common.FailOn,
		IgnorePaths:  append([]string(nil), req.Common.IgnorePaths...),
		ShowPaths:    req.Common.ShowPaths,
		OnlyBreaking: req.Common.OnlyBreaking,
		TextStyle:    req.Common.TextStyle,
		IgnoreOrder:  req.IgnoreOrder,
		UseColor:     guiUseColor(),
	}
	rawRun := runner.RunJSONValuesDetailed(oldValue, newValue, rawOpts)
	rawResult := CompareResponse{
		ExitCode:  rawRun.ExitCode,
		DiffFound: rawRun.DiffFound,
		Output:    rawRun.Output,
		Error:     errString(rawRun.Err),
	}

	structuredOpts := rawOpts
	structuredOpts.Format = output.JSONFormat
	structuredOpts.ShowPaths = false
	structuredOpts.UseColor = false
	structuredRun := runner.RunJSONValuesDetailed(oldValue, newValue, structuredOpts)

	diffs, err := parseJSONMachineDiffs(structuredRun.Output)
	if err != nil {
		return nil, err
	}

	return &CompareJSONRichResponse{
		Result:  rawResult,
		Summary: summarizeJSONRichDiffs(diffs),
		Diffs:   diffs,
	}, nil
}

func parseJSONMachineDiffs(raw string) ([]JSONRichDiffItem, error) {
	diffs := make([]JSONRichDiffItem, 0)
	if strings.TrimSpace(raw) == "" {
		return diffs, nil
	}

	var parsed jsonMachineResult
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
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

	return diffs, nil
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

func (s *Service) CompareSpecRich(req CompareSpecRequest) (*CompareSpecRichResponse, error) {
	rawResult, err := s.CompareSpecFiles(req)
	if err != nil {
		return nil, err
	}

	structuredReq := req
	structuredReq.Common.OutputFormat = output.JSONFormat
	structuredReq.Common.ShowPaths = false
	structuredReq.Common.NoColor = true

	structuredResult, err := s.CompareSpecFiles(structuredReq)
	if err != nil {
		return nil, err
	}

	diffs, err := parseSpecMachineDiffs(structuredResult.Output)
	if err != nil {
		return nil, err
	}

	return &CompareSpecRichResponse{
		Result:  *rawResult,
		Summary: summarizeSpecRichDiffs(diffs),
		Diffs:   diffs,
	}, nil
}

func (s *Service) CompareSpecValuesRich(req CompareSpecValuesRequest) (*CompareSpecRichResponse, error) {
	oldSpec, err := parseOpenAPISpecValue(req.OldValue, "old")
	if err != nil {
		return nil, err
	}
	newSpec, err := parseOpenAPISpecValue(req.NewValue, "new")
	if err != nil {
		return nil, err
	}

	diffs := openapi.ComparePathsMethods(oldSpec, newSpec)

	rawOptions := runner.CompareOptions{
		Format:        normalizeOutputFormat(req.Common.OutputFormat),
		FailOn:        req.Common.FailOn,
		IgnorePaths:   append([]string(nil), req.Common.IgnorePaths...),
		ShowPaths:     req.Common.ShowPaths,
		OnlyBreaking:  req.Common.OnlyBreaking,
		TextStyle:     req.Common.TextStyle,
		UseColor:      guiUseColor(),
		PathFormatter: openapi.HumanizePath,
	}
	rawRun := runner.RunDeltaDiffsDetailed(diffs, rawOptions)
	rawResult := CompareResponse{
		ExitCode:  rawRun.ExitCode,
		DiffFound: rawRun.DiffFound,
		Output:    rawRun.Output,
		Error:     errString(rawRun.Err),
	}

	structuredOptions := rawOptions
	structuredOptions.Format = output.JSONFormat
	structuredOptions.ShowPaths = false
	structuredOptions.UseColor = false
	structuredRun := runner.RunDeltaDiffsDetailed(diffs, structuredOptions)

	specDiffs, err := parseSpecMachineDiffs(structuredRun.Output)
	if err != nil {
		return nil, err
	}

	return &CompareSpecRichResponse{
		Result:  rawResult,
		Summary: summarizeSpecRichDiffs(specDiffs),
		Diffs:   specDiffs,
	}, nil
}

func parseOpenAPISpecValue(raw, side string) (any, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, fmt.Errorf("%s spec is empty", side)
	}

	jsonData, err := yaml.YAMLToJSON([]byte(raw))
	if err != nil {
		return nil, fmt.Errorf("failed to parse %s spec: %w", side, err)
	}

	var parsed any
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse %s spec: %w", side, err)
	}
	return parsed, nil
}

func parseSpecMachineDiffs(raw string) ([]SpecRichDiffItem, error) {
	if strings.TrimSpace(raw) == "" {
		return []SpecRichDiffItem{}, nil
	}

	var parsed jsonMachineResult
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse structured spec diff output: %w", err)
	}

	diffs := make([]SpecRichDiffItem, 0, len(parsed.Diffs))
	for _, item := range parsed.Diffs {
		groupKey, groupKind, label := deriveSpecGroupAndLabel(item.Path, item.Type)
		breaking := item.Type == "removed" || item.Type == "type_changed"
		diffs = append(diffs, SpecRichDiffItem{
			Type:      item.Type,
			Path:      item.Path,
			Label:     label,
			GroupKey:  groupKey,
			GroupKind: groupKind,
			Breaking:  breaking,
			OldValue:  item.OldValue,
			NewValue:  item.NewValue,
		})
	}

	return diffs, nil
}

var specSupportedMethods = []string{"get", "put", "post", "delete", "options", "head", "patch", "trace"}

func deriveSpecGroupAndLabel(path, diffType string) (groupKey, groupKind, label string) {
	if strings.HasPrefix(path, "paths.") {
		body := strings.TrimPrefix(path, "paths.")
		apiPath, method, rest, ok := splitSpecMethodPath(body)
		if ok {
			groupKey = strings.ToUpper(method) + " " + apiPath
			groupKind = "operation"
			switch {
			case rest == "":
				switch diffType {
				case "added":
					label = "Operation added"
				case "removed":
					label = "Operation removed"
				default:
					label = "Operation changed"
				}
			case rest == ".requestBody.required":
				label = "Request body required changed"
			case strings.HasPrefix(rest, ".responses."):
				tail := strings.TrimPrefix(rest, ".responses.")
				contentToken := ".content."
				contentIdx := strings.Index(tail, contentToken)
				if contentIdx > 0 {
					statusCode := tail[:contentIdx]
					contentAndSuffix := tail[contentIdx+len(contentToken):]
					suffix := ".schema.type"
					if strings.HasSuffix(contentAndSuffix, suffix) {
						contentType := strings.TrimSuffix(contentAndSuffix, suffix)
						label = fmt.Sprintf("Response schema type changed (%s %s)", statusCode, contentType)
					}
				}
				if label == "" {
					label = "Response changed"
				}
			default:
				label = openapi.HumanizePath(path)
			}

			if label == "" {
				label = openapi.HumanizePath(path)
			}
			return groupKey, groupKind, label
		}

		if idx := strings.Index(body, "."); idx > 0 {
			return body[:idx], "path", openapi.HumanizePath(path)
		}
		return body, "path", openapi.HumanizePath(path)
	}

	if strings.HasPrefix(path, "components.") {
		parts := strings.Split(path, ".")
		if len(parts) >= 3 {
			return strings.Join(parts[:3], "."), "component", openapi.HumanizePath(path)
		}
		return path, "component", openapi.HumanizePath(path)
	}

	return "(other)", "other", openapi.HumanizePath(path)
}

func splitSpecMethodPath(body string) (apiPath, method, rest string, ok bool) {
	bestIdx := -1
	bestMethod := ""
	bestEnd := -1

	for _, m := range specSupportedMethods {
		pattern := "." + m
		searchPos := 0
		for {
			idx := strings.Index(body[searchPos:], pattern)
			if idx < 0 {
				break
			}
			idx += searchPos
			end := idx + len(pattern)
			if end == len(body) || body[end] == '.' {
				if idx > bestIdx {
					bestIdx = idx
					bestMethod = m
					bestEnd = end
				}
			}
			searchPos = idx + 1
		}
	}

	if bestIdx <= 0 || bestMethod == "" {
		return "", "", "", false
	}

	return body[:bestIdx], bestMethod, body[bestEnd:], true
}

func summarizeSpecRichDiffs(diffs []SpecRichDiffItem) SpecRichSummary {
	summary := SpecRichSummary{}
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
	currentPath, currentPathErr := normalizeFolderCurrentPath(req.CurrentPath)
	if currentPathErr != nil {
		return &CompareFoldersResponse{
			Error: fmt.Sprintf("invalid currentPath: %v", currentPathErr),
		}, nil
	}

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

	scannedKeys := collectFolderKeys(leftEntries, rightEntries)
	nameFilter := strings.ToLower(strings.TrimSpace(req.NameFilter))

	resp := &CompareFoldersResponse{
		CurrentPath:    currentPath,
		ParentPath:     parentFolderPath(currentPath),
		ScannedSummary: FolderCompareSummary{},
		CurrentSummary: FolderCompareSummary{},
		Items:          make([]FolderCompareItem, 0),
	}

	for _, rel := range scannedKeys {
		item := buildFolderCompareItem(rel, leftRoot, rightRoot, req.Recursive, leftEntries, rightEntries)
		addFolderSummary(&resp.ScannedSummary, item.Status)
	}

	childNames, childErr := collectCurrentFolderChildNames(leftRoot, rightRoot, currentPath)
	if childErr != nil {
		resp.Error = fmt.Sprintf("current folder listing error: %v", childErr)
		return resp, nil
	}

	resp.Items = make([]FolderCompareItem, 0, len(childNames))
	for _, name := range childNames {
		relativePath := name
		if currentPath != "" {
			relativePath = currentPath + "/" + name
		}

		item := buildFolderCompareItem(
			relativePath,
			leftRoot,
			rightRoot,
			req.Recursive,
			leftEntries,
			rightEntries,
		)
		item.Name = name

		if !req.ShowSame && item.Status == "same" {
			continue
		}
		if nameFilter != "" && !strings.Contains(strings.ToLower(item.Name), nameFilter) {
			continue
		}

		resp.Items = append(resp.Items, item)
		addFolderSummary(&resp.CurrentSummary, item.Status)
	}

	sort.Slice(resp.Items, func(i, j int) bool {
		leftIsDir := resp.Items[i].IsDir
		rightIsDir := resp.Items[j].IsDir
		if leftIsDir != rightIsDir {
			return leftIsDir
		}
		return strings.ToLower(resp.Items[i].Name) < strings.ToLower(resp.Items[j].Name)
	})

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

func normalizeFolderCurrentPath(path string) (string, error) {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return "", nil
	}

	clean := filepath.ToSlash(filepath.Clean(trimmed))
	clean = strings.TrimPrefix(clean, "./")
	clean = strings.TrimPrefix(clean, "/")
	if clean == "." || clean == "" {
		return "", nil
	}

	segments := strings.Split(clean, "/")
	for _, segment := range segments {
		if segment == ".." {
			return "", fmt.Errorf("path traversal is not allowed")
		}
	}

	return clean, nil
}

func parentFolderPath(currentPath string) string {
	if currentPath == "" {
		return ""
	}

	parent := filepath.ToSlash(filepath.Dir(currentPath))
	if parent == "." {
		return ""
	}
	return parent
}

func collectCurrentFolderChildNames(leftRoot, rightRoot, currentPath string) ([]string, error) {
	names := map[string]struct{}{}

	add := func(root string) error {
		children, err := listCurrentFolderChildNames(root, currentPath)
		if err != nil {
			return err
		}
		for _, child := range children {
			names[child] = struct{}{}
		}
		return nil
	}

	if err := add(leftRoot); err != nil {
		return nil, err
	}
	if err := add(rightRoot); err != nil {
		return nil, err
	}

	out := make([]string, 0, len(names))
	for name := range names {
		out = append(out, name)
	}
	sort.Strings(out)
	return out, nil
}

func listCurrentFolderChildNames(root, currentPath string) ([]string, error) {
	base := root
	if currentPath != "" {
		base = filepath.Join(root, filepath.FromSlash(currentPath))
	}

	info, err := os.Stat(base)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", base)
	}

	entries, err := os.ReadDir(base)
	if err != nil {
		return nil, err
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	return names, nil
}

func buildFolderCompareItem(
	relativePath, leftRoot, rightRoot string,
	recursive bool,
	leftEntries, rightEntries map[string]folderEntrySnapshot,
) FolderCompareItem {
	left, leftOK := resolveFolderSnapshot(leftRoot, relativePath, leftEntries)
	right, rightOK := resolveFolderSnapshot(rightRoot, relativePath, rightEntries)

	item := FolderCompareItem{
		Name:         filepath.Base(relativePath),
		RelativePath: relativePath,
		LeftExists:   leftOK,
		RightExists:  rightOK,
		LeftKind:     "missing",
		RightKind:    "missing",
		LeftPath:     "",
		RightPath:    "",
		Status:       "error",
	}

	if leftOK {
		item.LeftPath = left.Path
		item.LeftKind = left.Kind
		item.LeftSize = left.Size
	}
	if rightOK {
		item.RightPath = right.Path
		item.RightKind = right.Kind
		item.RightSize = right.Size
	}

	switch {
	case leftOK && left.Err != nil:
		item.Status = "error"
		item.Message = left.Err.Error()
	case rightOK && right.Err != nil:
		item.Status = "error"
		item.Message = right.Err.Error()
	case !leftOK:
		item.Status = "right-only"
	case !rightOK:
		item.Status = "left-only"
	case left.Kind != right.Kind:
		item.Status = "type-mismatch"
	case left.Kind == "dir":
		item.IsDir = true
		if recursive {
			item.Status = aggregateDirectoryStatus(relativePath, leftEntries, rightEntries)
		} else {
			item.Status = "same"
		}
	case left.Kind == "file":
		if left.Size != right.Size {
			item.Status = "changed"
		} else {
			equal, cmpErr := compareFileContents(left.Path, right.Path)
			if cmpErr != nil {
				item.Status = "error"
				item.Message = cmpErr.Error()
			} else if equal {
				item.Status = "same"
			} else {
				item.Status = "changed"
			}
		}
	default:
		item.Status = "error"
		item.Message = "unsupported file kind"
	}

	item.CompareModeHint = inferCompareModeHint(
		item.RelativePath,
		item.Status,
		item.LeftKind,
		item.RightKind,
	)
	item.IsDir = item.LeftKind == "dir" || item.RightKind == "dir"
	return item
}

func aggregateDirectoryStatus(
	relativePath string,
	leftEntries, rightEntries map[string]folderEntrySnapshot,
) string {
	prefix := relativePath + "/"
	hasDescendant := false

	for key := range leftEntries {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		hasDescendant = true
		item := buildFolderCompareItem(key, "", "", false, leftEntries, rightEntries)
		if item.Status != "same" {
			return "changed"
		}
	}

	for key := range rightEntries {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		hasDescendant = true
		item := buildFolderCompareItem(key, "", "", false, leftEntries, rightEntries)
		if item.Status != "same" {
			return "changed"
		}
	}

	if !hasDescendant {
		return "same"
	}

	return "same"
}

func resolveFolderSnapshot(
	root, relativePath string,
	entries map[string]folderEntrySnapshot,
) (folderEntrySnapshot, bool) {
	if snap, ok := entries[relativePath]; ok {
		return snap, true
	}

	if root == "" {
		return folderEntrySnapshot{}, false
	}

	absPath := filepath.Join(root, filepath.FromSlash(relativePath))
	kind, size, err := classifyFolderPath(absPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return folderEntrySnapshot{}, false
		}
		return folderEntrySnapshot{
			Path: absPath,
			Kind: "unknown",
			Err:  err,
		}, true
	}

	return folderEntrySnapshot{
		Path: absPath,
		Kind: kind,
		Size: size,
	}, true
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
