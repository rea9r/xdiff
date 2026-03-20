package app

import (
	"fmt"

	"github.com/rea9r/apidiff/internal/diff"
	"github.com/rea9r/apidiff/internal/input"
	"github.com/rea9r/apidiff/internal/output"
)

func Run(args []string) (int, error) {
	if len(args) != 2 {
		return 2, fmt.Errorf("usage: apidiff old.json new.json")
	}

	oldValue, err := input.LoadJSONFile(args[0])
	if err != nil {
		return 2, err
	}

	newValue, err := input.LoadJSONFile(args[1])
	if err != nil {
		return 2, err
	}

	diffs := diff.Compare(oldValue, newValue)
	fmt.Print(output.FormatText(diffs))

	if len(diffs) > 0 {
		return 1, nil
	}
	return 0, nil
}
