package openapi

import (
	"testing"
)

func TestHumanizePath(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "operation",
			in:   "paths./users.post",
			want: "POST /users",
		},
		{
			name: "request body required",
			in:   "paths./users.post.requestBody.required",
			want: "POST /users request body required",
		},
		{
			name: "response schema type",
			in:   "paths./users.get.responses.200.content.application/json.schema.type",
			want: "GET /users response 200 application/json schema type",
		},
		{
			name: "unparseable path stays raw",
			in:   "user.name",
			want: "user.name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HumanizePath(tt.in)
			if got != tt.want {
				t.Fatalf("HumanizePath() mismatch: got=%q want=%q", got, tt.want)
			}
		})
	}
}
