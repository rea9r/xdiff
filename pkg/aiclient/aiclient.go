package aiclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	ProviderOllama    = "ollama"
	ProviderLlamafile = "llamafile"
)

const (
	DefaultOllamaBaseURL    = "http://localhost:11434"
	DefaultLlamafileBaseURL = "http://localhost:8080"
	pingTimeout             = 700 * time.Millisecond
	chatTimeout             = 90 * time.Second
)

type PullProgress struct {
	Status    string
	Total     int64
	Completed int64
}

type Provider struct {
	Name    string
	BaseURL string
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type Client struct {
	http     *http.Client
	pullHTTP *http.Client
}

func NewClient() *Client {
	return &Client{
		http:     &http.Client{Timeout: chatTimeout},
		pullHTTP: &http.Client{},
	}
}

func (c *Client) PingOllama(ctx context.Context, baseURL string) bool {
	return c.ping(ctx, baseURL+"/api/tags")
}

func (c *Client) PingLlamafile(ctx context.Context, baseURL string) bool {
	return c.ping(ctx, baseURL+"/v1/models")
}

func (c *Client) Detect(ctx context.Context) (*Provider, error) {
	if c.ping(ctx, DefaultOllamaBaseURL+"/api/tags") {
		return &Provider{Name: ProviderOllama, BaseURL: DefaultOllamaBaseURL}, nil
	}
	if c.ping(ctx, DefaultLlamafileBaseURL+"/v1/models") {
		return &Provider{Name: ProviderLlamafile, BaseURL: DefaultLlamafileBaseURL}, nil
	}
	return nil, errors.New("no AI provider reachable (Ollama at :11434, llamafile at :8080)")
}

func (c *Client) ping(ctx context.Context, url string) bool {
	pingCtx, cancel := context.WithTimeout(ctx, pingTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(pingCtx, http.MethodGet, url, nil)
	if err != nil {
		return false
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (c *Client) ListOllamaModels(ctx context.Context, baseURL string) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/tags", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama /api/tags returned %d", resp.StatusCode)
	}
	var body struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}
	names := make([]string, 0, len(body.Models))
	for _, m := range body.Models {
		names = append(names, m.Name)
	}
	return names, nil
}

func (c *Client) Chat(ctx context.Context, baseURL string, req ChatRequest) (string, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("chat completion returned %d: %s", resp.StatusCode, string(msg))
	}

	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.Error != nil {
		return "", errors.New(out.Error.Message)
	}
	if len(out.Choices) == 0 {
		return "", errors.New("chat completion returned no choices")
	}
	return out.Choices[0].Message.Content, nil
}

func (c *Client) PullOllamaModel(ctx context.Context, baseURL, name string, onProgress func(PullProgress)) error {
	body, err := json.Marshal(map[string]any{"name": name, "stream": true})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/pull", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.pullHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ollama /api/pull returned %d: %s", resp.StatusCode, string(msg))
	}

	dec := json.NewDecoder(resp.Body)
	for dec.More() {
		var line struct {
			Status    string `json:"status"`
			Total     int64  `json:"total"`
			Completed int64  `json:"completed"`
			Error     string `json:"error,omitempty"`
		}
		if err := dec.Decode(&line); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}
		if line.Error != "" {
			return errors.New(line.Error)
		}
		if onProgress != nil {
			onProgress(PullProgress{Status: line.Status, Total: line.Total, Completed: line.Completed})
		}
	}
	return nil
}
