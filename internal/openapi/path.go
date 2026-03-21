package openapi

import "strings"

type pathKind int

const (
	pathKindOperation pathKind = iota
	pathKindRequestBodyRequired
	pathKindResponseSchemaType
)

type pathRef struct {
	apiPath     string
	method      string
	kind        pathKind
	statusCode  string
	contentType string
}

func operationPath(apiPath, method string) pathRef {
	return pathRef{
		apiPath: apiPath,
		method:  strings.ToLower(method),
		kind:    pathKindOperation,
	}
}

func requestBodyRequiredPath(apiPath, method string) pathRef {
	return pathRef{
		apiPath: apiPath,
		method:  strings.ToLower(method),
		kind:    pathKindRequestBodyRequired,
	}
}

func responseSchemaTypePath(apiPath, method, statusCode, contentType string) pathRef {
	return pathRef{
		apiPath:     apiPath,
		method:      strings.ToLower(method),
		kind:        pathKindResponseSchemaType,
		statusCode:  statusCode,
		contentType: contentType,
	}
}

func (p pathRef) raw() string {
	base := "paths." + p.apiPath + "." + p.method

	switch p.kind {
	case pathKindOperation:
		return base
	case pathKindRequestBodyRequired:
		return base + ".requestBody.required"
	case pathKindResponseSchemaType:
		return base + ".responses." + p.statusCode + ".content." + p.contentType + ".schema.type"
	default:
		return base
	}
}

func (p pathRef) human() string {
	method := strings.ToUpper(p.method)

	switch p.kind {
	case pathKindOperation:
		return method + " " + p.apiPath
	case pathKindRequestBodyRequired:
		return method + " " + p.apiPath + " request body required"
	case pathKindResponseSchemaType:
		return method + " " + p.apiPath + " response " + p.statusCode + " " + p.contentType + " schema type"
	default:
		return p.raw()
	}
}

func parsePathRef(path string) (pathRef, bool) {
	const prefix = "paths."
	if !strings.HasPrefix(path, prefix) {
		return pathRef{}, false
	}

	body := path[len(prefix):]
	apiPath, method, rest, ok := splitMethodPath(body)
	if !ok {
		return pathRef{}, false
	}

	switch {
	case rest == "":
		return operationPath(apiPath, method), true
	case rest == ".requestBody.required":
		return requestBodyRequiredPath(apiPath, method), true
	case strings.HasPrefix(rest, ".responses."):
		tail := strings.TrimPrefix(rest, ".responses.")
		const contentToken = ".content."
		contentIdx := strings.Index(tail, contentToken)
		if contentIdx <= 0 {
			return pathRef{}, false
		}

		statusCode := tail[:contentIdx]
		contentAndSuffix := tail[contentIdx+len(contentToken):]
		const suffix = ".schema.type"
		if !strings.HasSuffix(contentAndSuffix, suffix) {
			return pathRef{}, false
		}

		contentType := strings.TrimSuffix(contentAndSuffix, suffix)
		if contentType == "" {
			return pathRef{}, false
		}

		return responseSchemaTypePath(apiPath, method, statusCode, contentType), true
	}

	return pathRef{}, false
}

func splitMethodPath(body string) (apiPath, method, rest string, ok bool) {
	bestIdx := -1
	bestMethod := ""
	bestEnd := -1

	for m := range supportedMethods {
		pattern := "." + m
		searchPos := 0

		for {
			idx := strings.Index(body[searchPos:], pattern)
			if idx < 0 {
				break
			}
			idx += searchPos
			end := idx + len(pattern)

			if end == len(body) || body[end] == '.' {
				if idx > bestIdx {
					bestIdx = idx
					bestMethod = m
					bestEnd = end
				}
			}

			searchPos = idx + 1
		}
	}

	if bestIdx <= 0 || bestMethod == "" {
		return "", "", "", false
	}

	return body[:bestIdx], bestMethod, body[bestEnd:], true
}
