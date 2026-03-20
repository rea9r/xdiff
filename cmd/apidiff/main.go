package main

import (
	"fmt"
	"os"

	"github.com/rea9r/apidiff/internal/app"
)

func main() {
	code, out, err := app.Run(os.Args[1:])
	if out != "" {
		fmt.Fprint(os.Stdout, out)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
	}
	os.Exit(code)
}
