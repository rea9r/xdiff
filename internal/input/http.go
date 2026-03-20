package input

import (
	"fmt"
	"net/http"
	"strings"
	"time"
)

type HTTPOptions struct {
	Headers []string
	Timeout time.Duration
}

func LoadJSONURL(rawURL string, opts HTTPOptions) (any, error) {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}

	client := &http.Client{
		Timeout: timeout,
	}

	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request for %q: %w", rawURL, err)
	}

	if err := applyHeaders(req, opts.Headers); err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to request %q: %w", rawURL, err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("request %q failed: status %d", rawURL, resp.StatusCode)
	}

	return decodeJSON(resp.Body, rawURL)
}

func applyHeaders(req *http.Request, rawHeaders []string) error {
	for _, h := range rawHeaders {
		parts := strings.SplitN(h, ":", 2)
		if len(parts) != 2 {
			return fmt.Errorf("invalid header %q: expected \"Key: Value\"", h)
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if key == "" {
			return fmt.Errorf("invalid header %q: key is empty", h)
		}
		req.Header.Add(key, value)
	}
	return nil
}
