package main

import "errors"

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
