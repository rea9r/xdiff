package desktopapi

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func (s *Service) DiffDirectories(req DiffDirectoriesRequest) (*DiffDirectoriesResponse, error) {
	leftRoot := strings.TrimSpace(req.LeftRoot)
	rightRoot := strings.TrimSpace(req.RightRoot)
	currentPath, currentPathErr := normalizeDirectoryCurrentPath(req.CurrentPath)
	if currentPathErr != nil {
		return &DiffDirectoriesResponse{
			Error: fmt.Sprintf("invalid currentPath: %v", currentPathErr),
		}, nil
	}

	if leftRoot == "" || rightRoot == "" {
		return &DiffDirectoriesResponse{
			Error: "leftRoot and rightRoot are required",
		}, nil
	}

	leftInfo, err := os.Stat(leftRoot)
	if err != nil {
		return &DiffDirectoriesResponse{Error: fmt.Sprintf("left root error: %v", err)}, nil
	}
	rightInfo, err := os.Stat(rightRoot)
	if err != nil {
		return &DiffDirectoriesResponse{Error: fmt.Sprintf("right root error: %v", err)}, nil
	}
	if !leftInfo.IsDir() || !rightInfo.IsDir() {
		return &DiffDirectoriesResponse{
			Error: "both leftRoot and rightRoot must be directories",
		}, nil
	}

	leftEntries, err := collectDirectoryEntries(leftRoot, req.Recursive)
	if err != nil {
		return &DiffDirectoriesResponse{Error: fmt.Sprintf("left root walk error: %v", err)}, nil
	}
	rightEntries, err := collectDirectoryEntries(rightRoot, req.Recursive)
	if err != nil {
		return &DiffDirectoriesResponse{Error: fmt.Sprintf("right root walk error: %v", err)}, nil
	}

	scannedKeys := collectDirectoryKeys(leftEntries, rightEntries)
	nameFilter := strings.ToLower(strings.TrimSpace(req.NameFilter))

	resp := &DiffDirectoriesResponse{
		CurrentPath:    currentPath,
		ParentPath:     parentDirectoryPath(currentPath),
		ScannedSummary: DirectoryDiffSummary{},
		CurrentSummary: DirectoryDiffSummary{},
		Items:          make([]DirectoryDiffItem, 0),
	}

	for _, rel := range scannedKeys {
		item := buildDirectoryDiffItem(rel, leftRoot, rightRoot, req.Recursive, leftEntries, rightEntries)
		addDirectorySummary(&resp.ScannedSummary, item.Status)
	}

	childNames, childErr := collectCurrentDirectoryChildNames(leftRoot, rightRoot, currentPath)
	if childErr != nil {
		resp.Error = fmt.Sprintf("current directory listing error: %v", childErr)
		return resp, nil
	}

	resp.Items = make([]DirectoryDiffItem, 0, len(childNames))
	for _, name := range childNames {
		relativePath := name
		if currentPath != "" {
			relativePath = currentPath + "/" + name
		}

		item := buildDirectoryDiffItem(
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
		addDirectorySummary(&resp.CurrentSummary, item.Status)
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

func collectDirectoryEntries(root string, recursive bool) (map[string]directoryEntrySnapshot, error) {
	out := make(map[string]directoryEntrySnapshot)
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
				out[rel] = directoryEntrySnapshot{
					Path: path,
					Kind: "unknown",
					Err:  err,
				}
				return nil
			}

			kind, size, kindErr := classifyDirectoryPath(path)
			out[rel] = directoryEntrySnapshot{
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
		kind, size, kindErr := classifyDirectoryPath(path)
		out[filepath.ToSlash(d.Name())] = directoryEntrySnapshot{
			Path: path,
			Kind: kind,
			Size: size,
			Err:  kindErr,
		}
	}
	return out, nil
}

func collectDirectoryKeys(
	leftEntries map[string]directoryEntrySnapshot,
	rightEntries map[string]directoryEntrySnapshot,
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

func classifyDirectoryPath(path string) (string, int64, error) {
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

func diffFileContents(leftPath, rightPath string) (_ bool, err error) {
	left, err := os.Open(leftPath) //nolint:gosec // G304: path from user-selected directory
	if err != nil {
		return false, err
	}
	defer func() {
		if cerr := left.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	right, err := os.Open(rightPath) //nolint:gosec // G304: path from user-selected directory
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

func inferDiffModeHint(relativePath, status, leftKind, rightKind string) string {
	if status != "same" && status != "changed" {
		return "none"
	}
	if leftKind != "file" || rightKind != "file" {
		return "none"
	}

	ext := strings.ToLower(filepath.Ext(relativePath))
	if ext == ".json" {
		return "json"
	}
	return "text"
}

func normalizeDirectoryCurrentPath(path string) (string, error) {
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

func parentDirectoryPath(currentPath string) string {
	if currentPath == "" {
		return ""
	}

	parent := filepath.ToSlash(filepath.Dir(currentPath))
	if parent == "." {
		return ""
	}
	return parent
}

func collectCurrentDirectoryChildNames(leftRoot, rightRoot, currentPath string) ([]string, error) {
	names := map[string]struct{}{}

	add := func(root string) error {
		children, err := listCurrentDirectoryChildNames(root, currentPath)
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

func listCurrentDirectoryChildNames(root, currentPath string) ([]string, error) {
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

func buildDirectoryDiffItem(
	relativePath, leftRoot, rightRoot string,
	recursive bool,
	leftEntries, rightEntries map[string]directoryEntrySnapshot,
) DirectoryDiffItem {
	left, leftOK := resolveDirectorySnapshot(leftRoot, relativePath, leftEntries)
	right, rightOK := resolveDirectorySnapshot(rightRoot, relativePath, rightEntries)

	item := DirectoryDiffItem{
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
			equal, cmpErr := diffFileContents(left.Path, right.Path)
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

	item.DiffModeHint = inferDiffModeHint(
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
	leftEntries, rightEntries map[string]directoryEntrySnapshot,
) string {
	prefix := relativePath + "/"
	hasDescendant := false

	for key := range leftEntries {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		hasDescendant = true
		item := buildDirectoryDiffItem(key, "", "", false, leftEntries, rightEntries)
		if item.Status != "same" {
			return "changed"
		}
	}

	for key := range rightEntries {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		hasDescendant = true
		item := buildDirectoryDiffItem(key, "", "", false, leftEntries, rightEntries)
		if item.Status != "same" {
			return "changed"
		}
	}

	if !hasDescendant {
		return "same"
	}

	return "same"
}

func resolveDirectorySnapshot(
	root, relativePath string,
	entries map[string]directoryEntrySnapshot,
) (directoryEntrySnapshot, bool) {
	if snap, ok := entries[relativePath]; ok {
		return snap, true
	}

	if root == "" {
		return directoryEntrySnapshot{}, false
	}

	absPath := filepath.Join(root, filepath.FromSlash(relativePath))
	kind, size, err := classifyDirectoryPath(absPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return directoryEntrySnapshot{}, false
		}
		return directoryEntrySnapshot{
			Path: absPath,
			Kind: "unknown",
			Err:  err,
		}, true
	}

	return directoryEntrySnapshot{
		Path: absPath,
		Kind: kind,
		Size: size,
	}, true
}

func addDirectorySummary(summary *DirectoryDiffSummary, status string) {
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
