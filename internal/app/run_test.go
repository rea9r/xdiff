package app

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestParseArgs(t *testing.T) {
	tests := []struct {
		name    string
		args    []string
		want    config
		wantErr bool
	}{
		{
			name: "default format",
			args: []string{"old.json", "new.json"},
			want: config{
				format:       "text",
				ignorePaths:  nil,
				onlyBreaking: false,
				oldPath:      "old.json",
				newPath:      "new.json",
			},
		},
		{
			name: "format flag short style",
			args: []string{"-format", "json", "old.json", "new.json"},
			want: config{
				format:       "json",
				ignorePaths:  nil,
				onlyBreaking: false,
				oldPath:      "old.json",
				newPath:      "new.json",
			},
		},
		{
			name: "format flag long style",
			args: []string{"--format=json", "old.json", "new.json"},
			want: config{
				format:       "json",
				ignorePaths:  nil,
				onlyBreaking: false,
				oldPath:      "old.json",
				newPath:      "new.json",
			},
		},
		{
			name: "ignore path repeated",
			args: []string{"--ignore-path", "user.updated_at", "--ignore-path=meta.request_id", "old.json", "new.json"},
			want: config{
				format:       "text",
				ignorePaths:  []string{"user.updated_at", "meta.request_id"},
				onlyBreaking: false,
				oldPath:      "old.json",
				newPath:      "new.json",
			},
		},
		{
			name: "only breaking",
			args: []string{"--only-breaking", "old.json", "new.json"},
			want: config{
				format:       "text",
				ignorePaths:  nil,
				onlyBreaking: true,
				oldPath:      "old.json",
				newPath:      "new.json",
			},
		},
		{
			name:    "invalid format",
			args:    []string{"--format", "yaml", "old.json", "new.json"},
			wantErr: true,
		},
		{
			name:    "missing file args",
			args:    []string{"--format", "json", "old.json"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseArgs(tt.args)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("parseArgs returned error: %v", err)
			}
			if diff := cmp.Diff(tt.want, got, cmp.AllowUnexported(config{})); diff != "" {
				t.Fatalf("config mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
