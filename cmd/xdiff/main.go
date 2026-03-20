package main

import (
	"os"
)

func main() {
	code, err := runCLI(os.Args[1:])
	if err != nil {
		if writeErr := writeStderr(err.Error() + "\n"); writeErr != nil {
			os.Exit(2)
		}
	}
	os.Exit(code)
}
