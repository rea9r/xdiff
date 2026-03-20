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

	return decodeJSON(bytes.NewReader(data), path)
}

func decodeJSON(r io.Reader, source string) (any, error) {
	dec := json.NewDecoder(r)
	dec.UseNumber()

	var value any
	if err := dec.Decode(&value); err != nil {
		return nil, fmt.Errorf("failed to parse JSON in %q: %w", source, err)
	}

	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		if err == nil {
			return nil, fmt.Errorf("invalid JSON in %q: multiple top-level values", source)
		}
		return nil, fmt.Errorf("failed to validate JSON in %q: %w", source, err)
	}

	return value, nil
}
