package desktopapi

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"

	"github.com/rea9r/xdiff/internal/runner"
)

func (s *Service) DiffText(req DiffTextRequest) (*DiffResponse, error) {
	opts := runner.DiffOptions{
		Format:           normalizeOutputFormat(req.Common.OutputFormat),
		IgnorePaths:      append([]string(nil), req.Common.IgnorePaths...),
		TextStyle:        req.Common.TextStyle,
		IgnoreWhitespace: req.Common.IgnoreWhitespace,
		IgnoreCase:       req.Common.IgnoreCase,
		IgnoreEOL:        req.Common.IgnoreEOL,
	}

	res := runner.RunTextValuesDetailed(req.OldText, req.NewText, opts)
	return &DiffResponse{
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

	enc := normalizeEncoding(req.Encoding)
	content, err := decodeBytes(body, enc)
	if err != nil {
		return nil, err
	}

	return &LoadTextFileResponse{
		Path:     path,
		Content:  content,
		Encoding: enc,
	}, nil
}

func (s *Service) SaveTextFile(req SaveTextFileRequest) (*SaveTextFileResponse, error) {
	path := strings.TrimSpace(req.Path)
	if path == "" {
		return nil, fmt.Errorf("path is required")
	}

	enc := normalizeEncoding(req.Encoding)
	body, err := encodeBytes(req.Content, enc)
	if err != nil {
		return nil, err
	}

	if err := os.WriteFile(path, body, 0o600); err != nil { //nolint:gosec // G304: path is user-provided desktop input
		return nil, err
	}

	return &SaveTextFileResponse{
		Path:     path,
		Encoding: enc,
	}, nil
}

func normalizeEncoding(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	switch v {
	case "", "utf-8", "utf8":
		return "utf-8"
	case "shift-jis", "shift_jis", "shiftjis", "sjis":
		return "shift-jis"
	case "euc-jp", "eucjp":
		return "euc-jp"
	case "utf-16-le", "utf16-le", "utf-16le":
		return "utf-16-le"
	case "utf-16-be", "utf16-be", "utf-16be":
		return "utf-16-be"
	case "iso-8859-1", "iso8859-1", "latin1":
		return "iso-8859-1"
	default:
		return v
	}
}

func decodeBytes(body []byte, enc string) (string, error) {
	switch enc {
	case "utf-8":
		if !utf8.Valid(body) {
			return "", fmt.Errorf("selected file is not valid UTF-8 text")
		}
		return string(body), nil
	case "shift-jis":
		return decodeWith(body, japanese.ShiftJIS.NewDecoder(), enc)
	case "euc-jp":
		return decodeWith(body, japanese.EUCJP.NewDecoder(), enc)
	case "utf-16-le":
		return decodeWith(body, unicode.UTF16(unicode.LittleEndian, unicode.UseBOM).NewDecoder(), enc)
	case "utf-16-be":
		return decodeWith(body, unicode.UTF16(unicode.BigEndian, unicode.UseBOM).NewDecoder(), enc)
	case "iso-8859-1":
		return decodeWith(body, charmap.ISO8859_1.NewDecoder(), enc)
	default:
		return "", fmt.Errorf("unsupported encoding: %s", enc)
	}
}

func decodeWith(body []byte, dec *encoding.Decoder, label string) (string, error) {
	reader := transform.NewReader(bytes.NewReader(body), dec)
	out, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("failed to decode as %s: %w", label, err)
	}
	return string(out), nil
}

func encodeBytes(content, enc string) ([]byte, error) {
	switch enc {
	case "utf-8":
		return []byte(content), nil
	case "shift-jis":
		return encodeWith(content, japanese.ShiftJIS.NewEncoder(), enc)
	case "euc-jp":
		return encodeWith(content, japanese.EUCJP.NewEncoder(), enc)
	case "utf-16-le":
		return encodeWith(content, unicode.UTF16(unicode.LittleEndian, unicode.UseBOM).NewEncoder(), enc)
	case "utf-16-be":
		return encodeWith(content, unicode.UTF16(unicode.BigEndian, unicode.UseBOM).NewEncoder(), enc)
	case "iso-8859-1":
		return encodeWith(content, charmap.ISO8859_1.NewEncoder(), enc)
	default:
		return nil, fmt.Errorf("unsupported encoding: %s", enc)
	}
}

func encodeWith(content string, enc *encoding.Encoder, label string) ([]byte, error) {
	reader := transform.NewReader(strings.NewReader(content), enc)
	out, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to encode as %s: %w", label, err)
	}
	return out, nil
}
