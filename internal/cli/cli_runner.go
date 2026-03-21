package cli

import (
	"errors"
	"io"
	"os"
)

func Execute(args []string, stdout, stderr io.Writer) int {
	if stdout == nil {
		stdout = os.Stdout
	}
	if stderr == nil {
		stderr = os.Stderr
	}
	stdoutWriter = stdout
	stderrWriter = stderr

	code, err := runCLI(args)
	if err != nil {
		if writeErr := writeStderr(err.Error() + "\n"); writeErr != nil {
			return 2
		}
	}
	return code
}

func runCLI(args []string) (int, error) {
	exitCode := 0

	root := newRootCommand(&exitCode)
	root.SetArgs(args)
	if err := root.Execute(); err != nil {
		if runErr, ok := errors.AsType[*runError](err); ok {
			return runErr.code, runErr.err
		}
		return 2, err
	}

	return exitCode, nil
}
