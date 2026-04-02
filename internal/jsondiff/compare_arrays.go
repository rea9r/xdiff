package jsondiff

import (
	"fmt"

	"github.com/rea9r/xdiff/internal/delta"
)

func compareArrays(path string, oldArr, newArr []any, depth int, diffs *[]delta.Diff) error {
	minLen := len(oldArr)
	if len(newArr) < minLen {
		minLen = len(newArr)
	}

	for i := 0; i < minLen; i++ {
		if err := compare(indexPath(path, i), oldArr[i], newArr[i], depth+1, diffs); err != nil {
			return err
		}
	}

	for i := minLen; i < len(oldArr); i++ {
		*diffs = append(*diffs, delta.Diff{
			Type:     delta.Removed,
			Path:     indexPath(path, i),
			OldValue: oldArr[i],
			NewValue: nil,
		})
	}

	for i := minLen; i < len(newArr); i++ {
		*diffs = append(*diffs, delta.Diff{
			Type:     delta.Added,
			Path:     indexPath(path, i),
			OldValue: nil,
			NewValue: newArr[i],
		})
	}

	return nil
}

func indexPath(base string, idx int) string {
	if base == "" {
		return fmt.Sprintf("[%d]", idx)
	}
	return fmt.Sprintf("%s[%d]", base, idx)
}
