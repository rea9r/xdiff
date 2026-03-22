package scenario

import (
	"time"

	"github.com/rea9r/xdiff/internal/runner"
)

const (
	KindJSON = "json"
	KindText = "text"
	KindURL  = "url"
	KindSpec = "spec"

	StatusOK    = "ok"
	StatusDiff  = "diff"
	StatusError = "error"
)

type Config struct {
	Version  int      `yaml:"version" json:"version"`
	Defaults Defaults `yaml:"defaults" json:"defaults"`
	Checks   []Check  `yaml:"checks" json:"checks"`
}

type Defaults struct {
	FailOn       string   `yaml:"fail_on" json:"fail_on"`
	IgnorePaths  []string `yaml:"ignore_paths" json:"ignore_paths"`
	ShowPaths    *bool    `yaml:"show_paths" json:"show_paths"`
	OnlyBreaking *bool    `yaml:"only_breaking" json:"only_breaking"`
	TextStyle    string   `yaml:"text_style" json:"text_style"`
	OutputFormat string   `yaml:"output_format" json:"output_format"`
	NoColor      *bool    `yaml:"no_color" json:"no_color"`
	IgnoreOrder  *bool    `yaml:"ignore_order" json:"ignore_order"`
	Headers      []string `yaml:"headers" json:"headers"`
	Timeout      string   `yaml:"timeout" json:"timeout"`
}

type Check struct {
	Name         string   `yaml:"name" json:"name"`
	Kind         string   `yaml:"kind" json:"kind"`
	Old          string   `yaml:"old" json:"old"`
	New          string   `yaml:"new" json:"new"`
	FailOn       string   `yaml:"fail_on" json:"fail_on"`
	IgnorePaths  []string `yaml:"ignore_paths" json:"ignore_paths"`
	ShowPaths    *bool    `yaml:"show_paths" json:"show_paths"`
	OnlyBreaking *bool    `yaml:"only_breaking" json:"only_breaking"`
	TextStyle    string   `yaml:"text_style" json:"text_style"`
	OutputFormat string   `yaml:"output_format" json:"output_format"`
	NoColor      *bool    `yaml:"no_color" json:"no_color"`
	IgnoreOrder  *bool    `yaml:"ignore_order" json:"ignore_order"`
	Headers      []string `yaml:"headers" json:"headers"`
	Timeout      string   `yaml:"timeout" json:"timeout"`
}

type ResolvedCheck struct {
	Name    string
	Kind    string
	Old     string
	New     string
	Compare runner.CompareOptions
	Headers []string
	Timeout time.Duration
}

type Result struct {
	Name         string `json:"name"`
	Kind         string `json:"kind"`
	Status       string `json:"status"`
	ExitCode     int    `json:"exit_code"`
	DiffFound    bool   `json:"diff_found"`
	Output       string `json:"output,omitempty"`
	ErrorMessage string `json:"error_message,omitempty"`
}

type Summary struct {
	Total    int `json:"total"`
	OK       int `json:"ok"`
	Diff     int `json:"diff"`
	Error    int `json:"error"`
	ExitCode int `json:"exit_code"`
}
