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

type operationSnapshot struct {
	RequestBodyRequired bool
	ResponseSchemaTypes map[string]map[string]string
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
			oldOp, hasOld := oldMethods[m]
			newOp, hasNew := newMethods[m]
			methodPath := "paths." + p + "." + m
			switch {
			case !hasOld && hasNew:
				diffs = append(diffs, diff.Diff{
					Type:     diff.Added,
					Path:     methodPath,
					OldValue: nil,
					NewValue: "operation",
				})
			case hasOld && !hasNew:
				diffs = append(diffs, diff.Diff{
					Type:     diff.Removed,
					Path:     methodPath,
					OldValue: "operation",
					NewValue: nil,
				})
			default:
				diffs = append(diffs, compareRequestBodyRequirement(methodPath, oldOp, newOp)...)
				diffs = append(diffs, compareResponseSchemaTypes(methodPath, oldOp, newOp)...)
			}
		}
	}

	return diffs
}

func extractPathMethods(spec any) map[string]map[string]operationSnapshot {
	root, ok := spec.(map[string]any)
	if !ok {
		return map[string]map[string]operationSnapshot{}
	}

	rawPaths, ok := root["paths"].(map[string]any)
	if !ok {
		return map[string]map[string]operationSnapshot{}
	}

	result := make(map[string]map[string]operationSnapshot, len(rawPaths))
	for path, rawPathItem := range rawPaths {
		pathItem, ok := rawPathItem.(map[string]any)
		if !ok {
			continue
		}
		methods := map[string]operationSnapshot{}
		for key, rawOperation := range pathItem {
			method := strings.ToLower(key)
			if _, supported := supportedMethods[method]; supported {
				op, ok := rawOperation.(map[string]any)
				if !ok {
					op = map[string]any{}
				}
				methods[method] = operationSnapshot{
					RequestBodyRequired: extractRequestBodyRequired(op),
					ResponseSchemaTypes: extractResponseSchemaTypes(op),
				}
			}
		}
		if len(methods) > 0 {
			result[path] = methods
		}
	}
	return result
}

func compareRequestBodyRequirement(methodPath string, oldOp, newOp operationSnapshot) []diff.Diff {
	oldRequired := oldOp.RequestBodyRequired
	newRequired := newOp.RequestBodyRequired
	if oldRequired == newRequired {
		return nil
	}

	path := methodPath + ".requestBody.required"
	if !oldRequired && newRequired {
		// Optional request body support disappeared: treat as breaking.
		return []diff.Diff{{
			Type:     diff.Removed,
			Path:     path,
			OldValue: "optional",
			NewValue: nil,
		}}
	}

	// Request body became optional: non-breaking.
	return []diff.Diff{{
		Type:     diff.Added,
		Path:     path,
		OldValue: nil,
		NewValue: "optional",
	}}
}

func compareResponseSchemaTypes(methodPath string, oldOp, newOp operationSnapshot) []diff.Diff {
	var diffs []diff.Diff

	statusSet := map[string]struct{}{}
	for status := range oldOp.ResponseSchemaTypes {
		statusSet[status] = struct{}{}
	}
	for status := range newOp.ResponseSchemaTypes {
		statusSet[status] = struct{}{}
	}

	statuses := make([]string, 0, len(statusSet))
	for status := range statusSet {
		statuses = append(statuses, status)
	}
	sort.Strings(statuses)

	for _, status := range statuses {
		oldContent := oldOp.ResponseSchemaTypes[status]
		newContent := newOp.ResponseSchemaTypes[status]

		contentSet := map[string]struct{}{}
		for contentType := range oldContent {
			contentSet[contentType] = struct{}{}
		}
		for contentType := range newContent {
			contentSet[contentType] = struct{}{}
		}

		contentTypes := make([]string, 0, len(contentSet))
		for contentType := range contentSet {
			contentTypes = append(contentTypes, contentType)
		}
		sort.Strings(contentTypes)

		for _, contentType := range contentTypes {
			oldType, hasOld := oldContent[contentType]
			newType, hasNew := newContent[contentType]
			path := methodPath + ".responses." + status + ".content." + contentType + ".schema.type"
			switch {
			case !hasOld && hasNew:
				diffs = append(diffs, diff.Diff{
					Type:     diff.Added,
					Path:     path,
					OldValue: nil,
					NewValue: newType,
				})
			case hasOld && !hasNew:
				diffs = append(diffs, diff.Diff{
					Type:     diff.Removed,
					Path:     path,
					OldValue: oldType,
					NewValue: nil,
				})
			case hasOld && hasNew && oldType != newType:
				diffs = append(diffs, diff.Diff{
					Type:     diff.TypeChanged,
					Path:     path,
					OldValue: oldType,
					NewValue: newType,
				})
			}
		}
	}

	return diffs
}

func extractRequestBodyRequired(op map[string]any) bool {
	rawRequestBody, ok := op["requestBody"].(map[string]any)
	if !ok {
		return false
	}

	required, ok := rawRequestBody["required"].(bool)
	return ok && required
}

func extractResponseSchemaTypes(op map[string]any) map[string]map[string]string {
	rawResponses, ok := op["responses"].(map[string]any)
	if !ok {
		return map[string]map[string]string{}
	}

	result := map[string]map[string]string{}
	for statusCode, rawResponse := range rawResponses {
		response, ok := rawResponse.(map[string]any)
		if !ok {
			continue
		}

		rawContent, ok := response["content"].(map[string]any)
		if !ok {
			continue
		}

		for contentType, rawMediaType := range rawContent {
			mediaType, ok := rawMediaType.(map[string]any)
			if !ok {
				continue
			}

			schema, ok := mediaType["schema"].(map[string]any)
			if !ok {
				continue
			}

			typ, ok := schema["type"].(string)
			if !ok || typ == "" {
				continue
			}

			if _, exists := result[statusCode]; !exists {
				result[statusCode] = map[string]string{}
			}
			result[statusCode][contentType] = typ
		}
	}

	return result
}
