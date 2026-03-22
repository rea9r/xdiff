package scenario

import (
	"fmt"
	"os"

	"sigs.k8s.io/yaml"
)

func LoadFile(path string) (Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("failed to read scenario file %q: %w", path, err)
	}

	var cfg Config
	if err := yaml.UnmarshalStrict(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("failed to parse scenario file %q: %w", path, err)
	}

	if cfg.Version != 1 {
		return Config{}, fmt.Errorf("unsupported scenario version %d (expected 1)", cfg.Version)
	}
	if len(cfg.Checks) == 0 {
		return Config{}, fmt.Errorf("scenario must contain at least one check")
	}

	return cfg, nil
}
