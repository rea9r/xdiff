package main

func writeOutput(out string) error {
	if out == "" {
		return nil
	}
	return writeStdout(out)
}
