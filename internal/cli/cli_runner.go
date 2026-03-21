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

	code, err := runCLI(args, stdout, stderr)
	if err != nil {
		if _, writeErr := io.WriteString(stderr, err.Error()+"\n"); writeErr != nil {
			return 2
		}
	}
	return code
}

func runCLI(args []string, stdout, stderr io.Writer) (int, error) {
	exitCode := 0

	root := newRootCommand(&exitCode, stdout, stderr)
	root.SetArgs(args)
	if err := root.Execute(); err != nil {
		if runErr, ok := errors.AsType[*runError](err); ok {
			return runErr.code, runErr.err
		}
		return 2, err
	}

	return exitCode, nil
}
