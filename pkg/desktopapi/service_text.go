package desktopapi

import (
	"fmt"
	"os"
	"strings"
	"unicode/utf8"

	"github.com/rea9r/xdiff/internal/runner"
)

func (s *Service) CompareText(req CompareTextRequest) (*CompareResponse, error) {
	opts := runner.CompareOptions{
		Format:      normalizeOutputFormat(req.Common.OutputFormat),
		IgnorePaths: append([]string(nil), req.Common.IgnorePaths...),
		ShowPaths:   req.Common.ShowPaths,
		TextStyle:   req.Common.TextStyle,
		UseColor:    guiUseColor(),
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

	body, err := os.ReadFile(path) //nolint:gosec // G304: path is user-provided desktop input
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
