package spec

import (
	"sort"
	"strings"

	"github.com/rea9r/apidiff/internal/diff"
)

var supportedMethods = map[string]struct{}{
	"get":     {},
	"put":     {},
	"post":    {},
	"delete":  {},
	"options": {},
	"head":    {},
	"patch":   {},
	"trace":   {},
}

func ComparePathsMethods(oldSpec, newSpec any) []diff.Diff {
	oldPaths := extractPathMethods(oldSpec)
	newPaths := extractPathMethods(newSpec)

	pathSet := map[string]struct{}{}
	for p := range oldPaths {
		pathSet[p] = struct{}{}
	}
	for p := range newPaths {
		pathSet[p] = struct{}{}
	}

	paths := make([]string, 0, len(pathSet))
	for p := range pathSet {
		paths = append(paths, p)
	}
	sort.Strings(paths)

	var diffs []diff.Diff
	for _, p := range paths {
		oldMethods := oldPaths[p]
		newMethods := newPaths[p]

		methodSet := map[string]struct{}{}
		for m := range oldMethods {
			methodSet[m] = struct{}{}
		}
		for m := range newMethods {
			methodSet[m] = struct{}{}
		}

		methods := make([]string, 0, len(methodSet))
		for m := range methodSet {
			methods = append(methods, m)
		}
		sort.Strings(methods)

		for _, m := range methods {
			_, hasOld := oldMethods[m]
			_, hasNew := newMethods[m]
			path := "paths." + p + "." + m
			switch {
			case !hasOld && hasNew:
				diffs = append(diffs, diff.Diff{
					Type:     diff.Added,
					Path:     path,
					OldValue: nil,
					NewValue: "operation",
				})
			case hasOld && !hasNew:
				diffs = append(diffs, diff.Diff{
					Type:     diff.Removed,
					Path:     path,
					OldValue: "operation",
					NewValue: nil,
				})
			}
		}
	}

	return diffs
}

func extractPathMethods(spec any) map[string]map[string]struct{} {
	root, ok := spec.(map[string]any)
	if !ok {
		return map[string]map[string]struct{}{}
	}

	rawPaths, ok := root["paths"].(map[string]any)
	if !ok {
		return map[string]map[string]struct{}{}
	}

	result := make(map[string]map[string]struct{}, len(rawPaths))
	for path, rawPathItem := range rawPaths {
		pathItem, ok := rawPathItem.(map[string]any)
		if !ok {
			continue
		}
		methods := map[string]struct{}{}
		for key := range pathItem {
			method := strings.ToLower(key)
			if _, supported := supportedMethods[method]; supported {
				methods[method] = struct{}{}
			}
		}
		if len(methods) > 0 {
			result[path] = methods
		}
	}
	return result
}
