package jsondiff

import (
	"bytes"
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/rea9r/xdiff/internal/delta"
)

func TestCompare(t *testing.T) {
	tests := []struct {
		name string
		old  string
		new  string
		want []delta.Diff
	}{
		{
			name: "added field",
			old:  `{"user":{"name":"Taro"}}`,
			new:  `{"user":{"name":"Taro","age":20}}`,
			want: []delta.Diff{
				{Type: delta.Added, Path: "user.age"},
			},
		},
		{
			name: "removed field",
			old:  `{"user":{"name":"Taro","email":"taro@example.com"}}`,
			new:  `{"user":{"name":"Taro"}}`,
			want: []delta.Diff{
				{Type: delta.Removed, Path: "user.email"},
			},
		},
		{
			name: "changed value",
			old:  `{"user":{"name":"Taro"}}`,
			new:  `{"user":{"name":"Hanako"}}`,
			want: []delta.Diff{
				{Type: delta.Changed, Path: "user.name"},
			},
		},
		{
			name: "type changed",
			old:  `{"user":{"age":"20"}}`,
			new:  `{"user":{"age":20}}`,
			want: []delta.Diff{
				{Type: delta.TypeChanged, Path: "user.age"},
			},
		},
		{
			name: "array element changed",
			old:  `{"items":["a","b"]}`,
			new:  `{"items":["a","c"]}`,
			want: []delta.Diff{
				{Type: delta.Changed, Path: "items[1]"},
			},
		},
		{
			name: "array element added",
			old:  `{"items":["a"]}`,
			new:  `{"items":["a","b"]}`,
			want: []delta.Diff{
				{Type: delta.Added, Path: "items[1]"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			oldValue := mustParseJSON(t, tt.old)
			newValue := mustParseJSON(t, tt.new)

			got, err := Compare(oldValue, newValue)
			if err != nil {
				t.Fatalf("Compare returned error: %v", err)
			}
			if diff := cmp.Diff(tt.want, got, cmpopts.IgnoreFields(delta.Diff{}, "OldValue", "NewValue")); diff != "" {
				t.Fatalf("diff mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCompareWithOptions_IgnoreOrder_ReorderedScalarArrayHasNoDiff(t *testing.T) {
	oldValue := mustParseJSON(t, `{"items":[1,2,3]}`)
	newValue := mustParseJSON(t, `{"items":[3,2,1]}`)

	got, err := CompareWithOptions(oldValue, newValue, Options{IgnoreOrder: true})
	if err != nil {
		t.Fatalf("CompareWithOptions returned error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected no diffs for reordered scalar array, got: %+v", got)
	}
}

func TestCompareWithOptions_IgnoreOrder_ReorderedObjectArrayHasNoDiff(t *testing.T) {
	oldValue := mustParseJSON(t, `{"items":[{"id":1,"name":"a"},{"id":2,"name":"b"}]}`)
	newValue := mustParseJSON(t, `{"items":[{"id":2,"name":"b"},{"id":1,"name":"a"}]}`)

	got, err := CompareWithOptions(oldValue, newValue, Options{IgnoreOrder: true})
	if err != nil {
		t.Fatalf("CompareWithOptions returned error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected no diffs for reordered object array, got: %+v", got)
	}
}

func TestCompareWithOptions_IgnoreOrder_ObjectFieldChangedStillDiffs(t *testing.T) {
	oldValue := mustParseJSON(t, `{"items":[{"id":1,"name":"a"},{"id":2,"name":"b"}]}`)
	newValue := mustParseJSON(t, `{"items":[{"id":2,"name":"B"},{"id":1,"name":"a"}]}`)

	got, err := CompareWithOptions(oldValue, newValue, Options{IgnoreOrder: true})
	if err != nil {
		t.Fatalf("CompareWithOptions returned error: %v", err)
	}
	if len(got) == 0 {
		t.Fatal("expected diffs when object field changes")
	}
}

func TestCompareWithOptions_IgnoreOrder_DuplicatesUseMultisetSemantics(t *testing.T) {
	oldValue := mustParseJSON(t, `{"items":[1,1,2]}`)
	newValue := mustParseJSON(t, `{"items":[1,2,2]}`)

	got, err := CompareWithOptions(oldValue, newValue, Options{IgnoreOrder: true})
	if err != nil {
		t.Fatalf("CompareWithOptions returned error: %v", err)
	}
	if len(got) == 0 {
		t.Fatal("expected diffs when multiplicity changes")
	}
}

func TestCompareWithOptions_DefaultOrderSensitive(t *testing.T) {
	oldValue := mustParseJSON(t, `{"items":[1,2,3]}`)
	newValue := mustParseJSON(t, `{"items":[3,2,1]}`)

	got, err := CompareWithOptions(oldValue, newValue, Options{})
	if err != nil {
		t.Fatalf("CompareWithOptions returned error: %v", err)
	}
	if len(got) == 0 {
		t.Fatal("expected diffs when ignore-order is disabled")
	}
}

func TestCompare_EqualsCompareWithDefaultOptions(t *testing.T) {
	oldValue := mustParseJSON(t, `{"items":[1,2,3],"obj":{"name":"taro"}}`)
	newValue := mustParseJSON(t, `{"items":[3,2,1],"obj":{"name":"hanako"}}`)

	gotCompare, err := Compare(oldValue, newValue)
	if err != nil {
		t.Fatalf("Compare returned error: %v", err)
	}
	gotWithOpts, err := CompareWithOptions(oldValue, newValue, Options{})
	if err != nil {
		t.Fatalf("CompareWithOptions returned error: %v", err)
	}

	if !reflect.DeepEqual(gotCompare, gotWithOpts) {
		t.Fatalf("expected Compare and CompareWithOptions(default) to match\nCompare: %#v\nCompareWithOptions: %#v", gotCompare, gotWithOpts)
	}
}

func TestCompareWithOptions_MaxDepthExceeded(t *testing.T) {
	oldValue := deeplyNestedObject(maxCompareDepth + 1)
	newValue := deeplyNestedObject(maxCompareDepth + 1)

	_, err := CompareWithOptions(oldValue, newValue, Options{})
	if err == nil {
		t.Fatal("expected max depth error, got nil")
	}
	if !strings.Contains(err.Error(), "maximum JSON compare depth exceeded") {
		t.Fatalf("expected max depth error, got: %v", err)
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

func deeplyNestedObject(depth int) any {
	if depth <= 0 {
		return map[string]any{"leaf": json.Number("1")}
	}

	current := map[string]any{"leaf": json.Number("1")}
	for i := 0; i < depth; i++ {
		current = map[string]any{"n": current}
	}
	return current
}
