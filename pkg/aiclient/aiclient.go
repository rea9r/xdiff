package aiclient

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
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
	// maxThinkingChunks bounds reasoning output to detect runaway loops.
	// Healthy explanations on small models emit ~1000–2000 thinking chunks;
	// stuck loops emit 5000+ identical-pattern chunks until the request
	// hits the call timeout.
	maxThinkingChunks = 3000
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
	Model     string        `json:"model"`
	Messages  []ChatMessage `json:"messages"`
	Stream    bool          `json:"stream"`
	KeepAlive string        `json:"keep_alive,omitempty"`
	// Think disables (false) or enables (true) the model's "thinking" /
	// reasoning step. Pointer so we only emit the field when explicitly set —
	// older Ollama versions and non-reasoning models simply ignore it.
	Think *bool `json:"think,omitempty"`
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
	defer func() { _ = resp.Body.Close() }()
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
	defer func() { _ = resp.Body.Close() }()
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

func (c *Client) Chat(ctx context.Context, provider Provider, req ChatRequest) (string, error) {
	if provider.Name == ProviderOllama {
		return c.chatOllama(ctx, provider.BaseURL, req)
	}
	return c.chatOpenAI(ctx, provider.BaseURL, req)
}

// ChatStream sends a chat request and invokes onChunk for each token chunk
// the model emits. It returns the full accumulated response on completion.
// For non-Ollama providers this falls back to a single non-streaming call
// and emits the full response as one chunk.
//
// onThinking is invoked for each "thinking" chunk emitted by reasoning
// models (e.g. qwen3.5). It is optional and may be nil for non-reasoning
// models or callers that don't care about thinking output.
func (c *Client) ChatStream(ctx context.Context, provider Provider, req ChatRequest, onChunk func(string), onThinking func(string)) (string, error) {
	if provider.Name == ProviderOllama {
		return c.chatStreamOllama(ctx, provider.BaseURL, req, onChunk, onThinking)
	}
	answer, err := c.chatOpenAI(ctx, provider.BaseURL, req)
	if err == nil && answer != "" && onChunk != nil {
		onChunk(answer)
	}
	return answer, err
}

func (c *Client) chatStreamOllama(ctx context.Context, baseURL string, req ChatRequest, onChunk func(string), onThinking func(string)) (string, error) {
	req.Stream = true
	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	log.Printf("[aiclient] POST %s/api/chat model=%s msgs=%d keep_alive=%q", baseURL, req.Model, len(req.Messages), req.KeepAlive)
	resp, err := c.pullHTTP.Do(httpReq)
	if err != nil {
		log.Printf("[aiclient] /api/chat Do error: %v", err)
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	log.Printf("[aiclient] /api/chat status=%d", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ollama /api/chat returned %d: %s", resp.StatusCode, string(msg))
	}

	var full strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	// Allow long lines: a single chunk may include large metadata on the final
	// done message. Default bufio limit (64KB) is sometimes not enough.
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	lineCount := 0
	thinkingCount := 0
	doneSent := false
	for scanner.Scan() {
		raw := scanner.Bytes()
		if len(bytes.TrimSpace(raw)) == 0 {
			continue
		}
		lineCount++
		if lineCount <= 2 {
			preview := string(raw)
			if len(preview) > 200 {
				preview = preview[:200] + "..."
			}
			log.Printf("[aiclient] line #%d: %s", lineCount, preview)
		}
		var line struct {
			Message struct {
				Content  string `json:"content"`
				Thinking string `json:"thinking,omitempty"`
			} `json:"message"`
			Done  bool   `json:"done"`
			Error string `json:"error,omitempty"`
		}
		if err := json.Unmarshal(raw, &line); err != nil {
			return full.String(), err
		}
		if line.Error != "" {
			return full.String(), errors.New(line.Error)
		}
		if line.Message.Thinking != "" {
			thinkingCount++
			if thinkingCount > maxThinkingChunks {
				log.Printf("[aiclient] thinking watchdog tripped at %d chunks; aborting", thinkingCount)
				return full.String(), fmt.Errorf("reasoning loop detected after %d thinking tokens — try a smaller diff or a larger model", thinkingCount)
			}
			if onThinking != nil {
				onThinking(line.Message.Thinking)
			}
		}
		if line.Message.Content != "" {
			full.WriteString(line.Message.Content)
			if onChunk != nil {
				onChunk(line.Message.Content)
			}
		}
		if line.Done {
			doneSent = true
			break
		}
	}
	if err := scanner.Err(); err != nil {
		log.Printf("[aiclient] scanner err lines=%d total=%d: %v", lineCount, full.Len(), err)
		return full.String(), err
	}
	log.Printf("[aiclient] /api/chat finished lines=%d total=%d done=%v ctxErr=%v", lineCount, full.Len(), doneSent, ctx.Err())
	// Some HTTP transports translate context cancellation into io.EOF when
	// reading the response body, which bufio.Scanner reports as no error.
	// Surface the context error explicitly so callers (and users) see why the
	// stream ended empty instead of getting a misleading nil error.
	if !doneSent && full.Len() == 0 {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", fmt.Errorf("ollama stream ended with no data: %w", ctxErr)
		}
		return "", errors.New("ollama stream ended with no data")
	}
	return full.String(), nil
}

func (c *Client) chatOllama(ctx context.Context, baseURL string, req ChatRequest) (string, error) {
	req.Stream = false
	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ollama /api/chat returned %d: %s", resp.StatusCode, string(msg))
	}

	var out struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		Error string `json:"error,omitempty"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.Error != "" {
		return "", errors.New(out.Error)
	}
	return out.Message.Content, nil
}

func (c *Client) chatOpenAI(ctx context.Context, baseURL string, req ChatRequest) (string, error) {
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
	defer func() { _ = resp.Body.Close() }()

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

func (c *Client) DeleteOllamaModel(ctx context.Context, baseURL, name string) error {
	body, err := json.Marshal(map[string]any{"name": name, "model": name})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, baseURL+"/api/delete", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ollama /api/delete returned %d: %s", resp.StatusCode, string(msg))
	}
	return nil
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
	defer func() { _ = resp.Body.Close() }()

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
