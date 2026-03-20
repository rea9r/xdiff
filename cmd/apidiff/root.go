package main

import "errors"

func runCLI(args []string) (int, error) {
	exitCode := 0

	root := newRootCommand(&exitCode)
	root.SetArgs(args)
	if err := root.Execute(); err != nil {
		var rerr *runError
		if errors.As(err, &rerr) {
			return rerr.code, rerr.err
		}
		return 2, err
	}

	return exitCode, nil
}
