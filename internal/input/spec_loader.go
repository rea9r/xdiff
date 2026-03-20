package input

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"sigs.k8s.io/yaml"
)

func LoadOpenAPISpecFile(path string) (any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %q: %w", path, err)
	}

	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".yaml" || ext == ".yml" {
		jsonData, err := yaml.YAMLToJSON(data)
		if err != nil {
			return nil, fmt.Errorf("failed to convert YAML to JSON in %q: %w", path, err)
		}
		return decodeJSON(bytes.NewReader(jsonData), path)
	}

	return decodeJSON(bytes.NewReader(data), path)
}
