package input

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

func LoadJSONFile(path string) (any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %q: %w", path, err)
	}

	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()

	var value any
	if err := dec.Decode(&value); err != nil {
		return nil, fmt.Errorf("failed to parse JSON in %q: %w", path, err)
	}

	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		if err == nil {
			return nil, fmt.Errorf("invalid JSON in %q: multiple top-level values", path)
		}
		return nil, fmt.Errorf("failed to validate JSON in %q: %w", path, err)
	}

	return value, nil
}
