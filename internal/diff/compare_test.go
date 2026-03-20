package diff

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

func TestCompare(t *testing.T) {
	tests := []struct {
		name string
		old  string
		new  string
		want []Diff
	}{
		{
			name: "added field",
			old:  `{"user":{"name":"Taro"}}`,
			new:  `{"user":{"name":"Taro","age":20}}`,
			want: []Diff{
				{Type: Added, Path: "user.age"},
			},
		},
		{
			name: "removed field",
			old:  `{"user":{"name":"Taro","email":"taro@example.com"}}`,
			new:  `{"user":{"name":"Taro"}}`,
			want: []Diff{
				{Type: Removed, Path: "user.email"},
			},
		},
		{
			name: "changed value",
			old:  `{"user":{"name":"Taro"}}`,
			new:  `{"user":{"name":"Hanako"}}`,
			want: []Diff{
				{Type: Changed, Path: "user.name"},
			},
		},
		{
			name: "type changed",
			old:  `{"user":{"age":"20"}}`,
			new:  `{"user":{"age":20}}`,
			want: []Diff{
				{Type: TypeChanged, Path: "user.age"},
			},
		},
		{
			name: "array element changed",
			old:  `{"items":["a","b"]}`,
			new:  `{"items":["a","c"]}`,
			want: []Diff{
				{Type: Changed, Path: "items[1]"},
			},
		},
		{
			name: "array element added",
			old:  `{"items":["a"]}`,
			new:  `{"items":["a","b"]}`,
			want: []Diff{
				{Type: Added, Path: "items[1]"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			oldValue := mustParseJSON(t, tt.old)
			newValue := mustParseJSON(t, tt.new)

			got := Compare(oldValue, newValue)
			if diff := cmp.Diff(tt.want, got, cmpopts.IgnoreFields(Diff{}, "OldValue", "NewValue")); diff != "" {
				t.Fatalf("diff mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func mustParseJSON(t *testing.T, s string) any {
	t.Helper()

	dec := json.NewDecoder(bytes.NewReader([]byte(s)))
	dec.UseNumber()

	var value any
	if err := dec.Decode(&value); err != nil {
		t.Fatalf("failed to parse json in test: %v", err)
	}

	return value
}
