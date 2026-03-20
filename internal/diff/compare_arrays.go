package diff

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
