package diff

import "sort"

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

func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
