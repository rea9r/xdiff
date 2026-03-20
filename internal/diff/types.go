package diff

import (
	"encoding/json"
	"reflect"
)

type DiffType string

const (
	Added       DiffType = "added"
	Removed     DiffType = "removed"
	Changed     DiffType = "changed"
	TypeChanged DiffType = "type_changed"
)

type Diff struct {
	Type     DiffType
	Path     string
	OldValue any
	NewValue any
}

func ValueType(v any) string {
	switch v.(type) {
	case nil:
		return "null"
	case bool:
		return "boolean"
	case string:
		return "string"
	case json.Number:
		return "number"
	case float64, float32, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return "number"
	case map[string]any:
		return "object"
	case []any:
		return "array"
	default:
		t := reflect.TypeOf(v)
		if t == nil {
			return "null"
		}
		return t.String()
	}
}
