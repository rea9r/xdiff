package openapi

func HumanizePath(path string) string {
	ref, ok := parsePathRef(path)
	if !ok {
		return path
	}
	return ref.human()
}
