package output

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/rea9r/xdiff/internal/delta"
)

func sampleDiffs() []delta.Diff {
	return []delta.Diff{
		{Type: delta.Added, Path: "user.phone", NewValue: "090"},
		{Type: delta.Removed, Path: "user.email", OldValue: "a@example.com"},
		{Type: delta.Changed, Path: "user.name", OldValue: "Taro", NewValue: "Hanako"},
		{Type: delta.TypeChanged, Path: "user.age", OldValue: "20", NewValue: json.Number("20")},
	}
}

func readGolden(t *testing.T, name string) string {
	t.Helper()

	path := filepath.Join("testdata", name)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read golden file %q: %v", path, err)
	}
	return string(data)
}
