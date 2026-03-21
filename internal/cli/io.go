package cli

import (
	"io"
	"os"
)

var (
	stdoutWriter io.Writer = os.Stdout
	stderrWriter io.Writer = os.Stderr
)

func writeStdout(s string) error {
	return writeString(stdoutWriter, s)
}

func writeStderr(s string) error {
	return writeString(stderrWriter, s)
}

func writeString(w io.Writer, s string) error {
	_, err := io.WriteString(w, s)
	return err
}
