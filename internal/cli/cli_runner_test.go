package cli

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func runCLIForTest(args []string) (int, error) {
	return runCLI(args, io.Discard)
}

func TestRunCLI_MissingArgs(t *testing.T) {
	code, err := runCLIForTest([]string{})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
}

func TestRunCLI_UnknownCommand(t *testing.T) {
	code, err := runCLIForTest([]string{"example"})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
}

func TestRunCLI_InvalidFormat(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--output-format", "yaml", oldPath, newPath})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), "invalid output format") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_Text_SuccessDiffFound(t *testing.T) {
	oldPath := writeCLIFile(t, "hello\nworld\n", "old.txt")
	newPath := writeCLIFile(t, "hello\ngopher\n", "new.txt")

	code, err := runCLIForTest([]string{"text", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_Text_JSONFormat(t *testing.T) {
	oldPath := writeCLIFile(t, "a\n", "old.txt")
	newPath := writeCLIFile(t, "b\n", "new.txt")

	code, err := runCLIForTest([]string{"text", "--output-format", "json", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func TestRunCLI_IgnoreOrder_ReorderedArrayReturnsZero(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"items":[1,2,3]}`, "old.json")
	newPath := writeCLIJSON(t, `{"items":[3,2,1]}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--ignore-order", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 0 {
		t.Fatalf("exit code mismatch: got=%d want=0", code)
	}
}

func TestRunCLI_PatchStyleWithIgnoreOrderReturnsError(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"items":[1,2,3]}`, "old.json")
	newPath := writeCLIJSON(t, `{"items":[3,2,1]}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--text-style", "patch", "--ignore-order", oldPath, newPath})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), `text style "patch" cannot be used with --ignore-path or --ignore-order`) {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_InvalidTextStyle(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, err := runCLIForTest([]string{"json", "--text-style", "fancy", oldPath, newPath})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), `invalid text style "fancy"`) {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestExecute_PrintsHintsForPatchAndIgnoreOrderConflict(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"items":[1,2,3]}`, "old.json")
	newPath := writeCLIJSON(t, `{"items":[3,2,1]}`, "new.json")

	var stderr bytes.Buffer
	code := Execute(
		[]string{"json", "--text-style", "patch", "--ignore-order", oldPath, newPath},
		io.Discard,
		&stderr,
	)
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}

	msg := stderr.String()
	if !strings.Contains(msg, `text style "patch" cannot be used with --ignore-path or --ignore-order`) {
		t.Fatalf("unexpected stderr: %q", msg)
	}
	if !strings.Contains(msg, "Try one of these:") {
		t.Fatalf("expected hint header, got: %q", msg)
	}
}

func TestRunCLI_RootTwoArgsReturnsHintAwareError(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, err := runCLIForTest([]string{oldPath, newPath})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if code != 2 {
		t.Fatalf("exit code mismatch: got=%d want=2", code)
	}
	if !strings.Contains(err.Error(), "local comparison mode must be explicit") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRunCLI_JSONCommand_SuccessDiffFound(t *testing.T) {
	oldPath := writeCLIJSON(t, `{"user":{"name":"Taro"}}`, "old.json")
	newPath := writeCLIJSON(t, `{"user":{"name":"Hanako"}}`, "new.json")

	code, err := runCLIForTest([]string{"json", oldPath, newPath})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if code != 1 {
		t.Fatalf("exit code mismatch: got=%d want=1", code)
	}
}

func writeCLIJSON(t *testing.T, content string, fileName string) string {
	return writeCLIFile(t, content, fileName)
}

func writeCLIFile(t *testing.T, content string, fileName string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), fileName)
	normalized := strings.TrimSpace(content) + "\n"
	if err := os.WriteFile(path, []byte(normalized), 0o600); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return path
}
