package main

import (
	"os"

	"github.com/rea9r/apidiff/internal/app"
)

func main() {
	code, out, err := app.Run(os.Args[1:])
	if out != "" {
		if writeErr := writeStdout(out); writeErr != nil {
			_ = writeStderr("error: " + writeErr.Error() + "\n")
			os.Exit(2)
		}
	}
	if err != nil {
		if writeErr := writeStderr(err.Error() + "\n"); writeErr != nil {
			os.Exit(2)
		}
	}
	os.Exit(code)
}
