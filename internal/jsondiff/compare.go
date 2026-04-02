package jsondiff

import (
	"fmt"
	"reflect"

	"github.com/rea9r/xdiff/internal/delta"
)

const maxCompareDepth = 1000

func Compare(oldValue, newValue any) ([]delta.Diff, error) {
	return CompareWithOptions(oldValue, newValue, Options{})
}

func CompareWithOptions(oldValue, newValue any, opts Options) ([]delta.Diff, error) {
	if opts.IgnoreOrder {
		oldValue = normalizeUnorderedValue(oldValue)
		newValue = normalizeUnorderedValue(newValue)
	}

	var diffs []delta.Diff
	if err := compare("", oldValue, newValue, 0, &diffs); err != nil {
		return nil, err
	}
	return diffs, nil
}

func compare(path string, oldValue, newValue any, depth int, diffs *[]delta.Diff) error {
	if depth > maxCompareDepth {
		return fmt.Errorf(
			"maximum JSON compare depth exceeded (%d) at path %q",
			maxCompareDepth,
			path,
		)
	}

	oldObj, oldIsObj := oldValue.(map[string]any)
	newObj, newIsObj := newValue.(map[string]any)
	if oldIsObj || newIsObj {
		if !oldIsObj || !newIsObj {
			*diffs = append(*diffs, delta.Diff{
				Type:     delta.TypeChanged,
				Path:     path,
				OldValue: oldValue,
				NewValue: newValue,
			})
			return nil
		}
		return compareObjects(path, oldObj, newObj, depth, diffs)
	}

	oldArr, oldIsArr := oldValue.([]any)
	newArr, newIsArr := newValue.([]any)
	if oldIsArr || newIsArr {
		if !oldIsArr || !newIsArr {
			*diffs = append(*diffs, delta.Diff{
				Type:     delta.TypeChanged,
				Path:     path,
				OldValue: oldValue,
				NewValue: newValue,
			})
			return nil
		}
		return compareArrays(path, oldArr, newArr, depth, diffs)
	}

	if reflect.TypeOf(oldValue) != reflect.TypeOf(newValue) {
		appendTypeChanged(diffs, path, oldValue, newValue)
		return nil
	}

	if !reflect.DeepEqual(oldValue, newValue) {
		*diffs = append(*diffs, delta.Diff{
			Type:     delta.Changed,
			Path:     path,
			OldValue: oldValue,
			NewValue: newValue,
		})
	}
	return nil
}

func appendTypeChanged(diffs *[]delta.Diff, path string, oldValue, newValue any) {
	*diffs = append(*diffs, delta.Diff{
		Type:     delta.TypeChanged,
		Path:     path,
		OldValue: oldValue,
		NewValue: newValue,
	})
}
