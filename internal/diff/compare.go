package diff

import (
	"fmt"
	"reflect"
	"sort"
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
		*diffs = append(*diffs, Diff{
			Type:     TypeChanged,
			Path:     path,
			OldValue: oldValue,
			NewValue: newValue,
		})
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

func compareObjects(path string, oldObj, newObj map[string]any, diffs *[]Diff) {
	oldKeys := sortedKeys(oldObj)
	newKeys := sortedKeys(newObj)

	newSet := make(map[string]struct{}, len(newKeys))
	for _, key := range newKeys {
		newSet[key] = struct{}{}
	}

	oldSet := make(map[string]struct{}, len(oldKeys))
	for _, key := range oldKeys {
		oldSet[key] = struct{}{}
	}

	for _, key := range oldKeys {
		if _, exists := newSet[key]; !exists {
			*diffs = append(*diffs, Diff{
				Type:     Removed,
				Path:     joinPath(path, key),
				OldValue: oldObj[key],
				NewValue: nil,
			})
		}
	}

	for _, key := range newKeys {
		if _, exists := oldSet[key]; !exists {
			*diffs = append(*diffs, Diff{
				Type:     Added,
				Path:     joinPath(path, key),
				OldValue: nil,
				NewValue: newObj[key],
			})
			continue
		}

		compare(joinPath(path, key), oldObj[key], newObj[key], diffs)
	}
}

func compareArrays(path string, oldArr, newArr []any, diffs *[]Diff) {
	minLen := len(oldArr)
	if len(newArr) < minLen {
		minLen = len(newArr)
	}

	for i := 0; i < minLen; i++ {
		compare(indexPath(path, i), oldArr[i], newArr[i], diffs)
	}

	for i := minLen; i < len(oldArr); i++ {
		*diffs = append(*diffs, Diff{
			Type:     Removed,
			Path:     indexPath(path, i),
			OldValue: oldArr[i],
			NewValue: nil,
		})
	}

	for i := minLen; i < len(newArr); i++ {
		*diffs = append(*diffs, Diff{
			Type:     Added,
			Path:     indexPath(path, i),
			OldValue: nil,
			NewValue: newArr[i],
		})
	}
}

func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func joinPath(base, key string) string {
	if base == "" {
		return key
	}
	return base + "." + key
}

func indexPath(base string, idx int) string {
	if base == "" {
		return fmt.Sprintf("[%d]", idx)
	}
	return fmt.Sprintf("%s[%d]", base, idx)
}
