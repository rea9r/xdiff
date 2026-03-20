package diff

import (
	"reflect"
)

func Compare(oldValue, newValue any) []Diff {
	var diffs []Diff
	compare("", oldValue, newValue, &diffs)
	return diffs
}

func compare(path string, oldValue, newValue any, diffs *[]Diff) {
	oldObj, oldIsObj := oldValue.(map[string]any)
	newObj, newIsObj := newValue.(map[string]any)
	if oldIsObj || newIsObj {
		if !oldIsObj || !newIsObj {
			*diffs = append(*diffs, Diff{
				Type:     TypeChanged,
				Path:     path,
				OldValue: oldValue,
				NewValue: newValue,
			})
			return
		}
		compareObjects(path, oldObj, newObj, diffs)
		return
	}

	oldArr, oldIsArr := oldValue.([]any)
	newArr, newIsArr := newValue.([]any)
	if oldIsArr || newIsArr {
		if !oldIsArr || !newIsArr {
			*diffs = append(*diffs, Diff{
				Type:     TypeChanged,
				Path:     path,
				OldValue: oldValue,
				NewValue: newValue,
			})
			return
		}
		compareArrays(path, oldArr, newArr, diffs)
		return
	}

	if reflect.TypeOf(oldValue) != reflect.TypeOf(newValue) {
		appendTypeChanged(diffs, path, oldValue, newValue)
		return
	}

	if !reflect.DeepEqual(oldValue, newValue) {
		*diffs = append(*diffs, Diff{
			Type:     Changed,
			Path:     path,
			OldValue: oldValue,
			NewValue: newValue,
		})
	}
}

func appendTypeChanged(diffs *[]Diff, path string, oldValue, newValue any) {
	*diffs = append(*diffs, Diff{
		Type:     TypeChanged,
		Path:     path,
		OldValue: oldValue,
		NewValue: newValue,
	})
}
