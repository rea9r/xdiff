package source

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type HTTPOptions struct {
	Headers []string
	Timeout time.Duration
}

var maxJSONURLResponseBytes int64 = 100 * 1024 * 1024

func LoadJSONURL(ctx context.Context, rawURL string, opts HTTPOptions) (any, error) {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}

	client := &http.Client{
		Timeout: timeout,
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
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

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxJSONURLResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read response body from %q: %w", rawURL, err)
	}
	if int64(len(body)) > maxJSONURLResponseBytes {
		return nil, fmt.Errorf(
			"response body from %q exceeds size limit (%d bytes)",
			rawURL,
			maxJSONURLResponseBytes,
		)
	}

	return decodeJSON(bytes.NewReader(body), rawURL)
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
