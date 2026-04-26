package desktopapi

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/rea9r/xdiff/pkg/aiclient"
)

const (
	aiCallTimeout       = 180 * time.Second
	aiDefaultModel      = "qwen3.5:0.8b"
	aiDiffSnippetLimit  = 16000
	aiSystemInstruction = `You are a senior code reviewer. The user gives you a diff (unified diff for text mode, structured diff lines for JSON mode). Explain the changes for someone reviewing them.

Output format:
- One short sentence summarizing the change.
- Bulleted list of the most important concrete changes (max 6 bullets). Quote identifier names where relevant.
- A short "Watch out" line only if there is a real risk (breaking change, removed API, behavioral shift). Skip otherwise.

Respond in the same language the diff content is written in. If ambiguous, use English. Be concise. Do not restate the diff verbatim.`
)

const (
	aiPhaseIdle     = "idle"
	aiPhaseStarting = "starting"
	aiPhaseWaiting  = "waiting"
	aiPhasePulling  = "pulling"
	aiPhaseReady    = "ready"
	aiPhaseError    = "error"
)

type aiSetupState struct {
	mu       sync.RWMutex
	progress AISetupProgress
	cancel   context.CancelFunc
	running  bool
}

func (a *aiSetupState) snapshot() AISetupProgress {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.progress
}

func (a *aiSetupState) update(mut func(p *AISetupProgress)) {
	a.mu.Lock()
	defer a.mu.Unlock()
	mut(&a.progress)
}

func (s *Service) setupState() *aiSetupState {
	s.aiSetupOnce.Do(func() {
		s.aiSetup = &aiSetupState{progress: AISetupProgress{Phase: aiPhaseIdle}}
	})
	return s.aiSetup
}

func (s *Service) AIProviderStatus() (*AIProviderStatus, error) {
	client := aiclient.NewClient()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	status := &AIProviderStatus{
		OllamaInstalled: ollamaBinaryFound(),
		CanAutoStart:    canAutoStartOllama(),
		HardwareTier:    detectHardwareTier(),
	}

	if client.PingOllama(ctx, aiclient.DefaultOllamaBaseURL) {
		status.OllamaReachable = true
		status.Available = true
		status.Provider = aiclient.ProviderOllama
		status.BaseURL = aiclient.DefaultOllamaBaseURL
		if models, err := client.ListOllamaModels(ctx, aiclient.DefaultOllamaBaseURL); err == nil {
			status.Models = models
			if len(models) == 0 {
				status.Available = false
			}
		}
		return status, nil
	}

	if client.PingLlamafile(ctx, aiclient.DefaultLlamafileBaseURL) {
		status.Available = true
		status.Provider = aiclient.ProviderLlamafile
		status.BaseURL = aiclient.DefaultLlamafileBaseURL
		return status, nil
	}

	if !status.OllamaInstalled {
		status.Error = "Ollama is not installed"
	} else {
		status.Error = "Ollama is installed but not running"
	}
	return status, nil
}

func (s *Service) ExplainDiff(req ExplainDiffRequest) (*ExplainDiffResponse, error) {
	diff := strings.TrimSpace(req.DiffText)
	if diff == "" {
		return nil, errors.New("diffText is required")
	}
	if len(diff) > aiDiffSnippetLimit {
		diff = diff[:aiDiffSnippetLimit] + "\n\n[... diff truncated for length ...]"
	}

	client := aiclient.NewClient()
	ctx, cancel := context.WithTimeout(context.Background(), aiCallTimeout)
	defer cancel()

	provider, err := client.Detect(ctx)
	if err != nil {
		return &ExplainDiffResponse{Error: err.Error()}, nil
	}

	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = aiDefaultModel
	}

	answer, err := client.Chat(ctx, provider.BaseURL, aiclient.ChatRequest{
		Model: model,
		Messages: []aiclient.ChatMessage{
			{Role: "system", Content: aiSystemInstruction},
			{Role: "user", Content: buildExplainPrompt(diff, req.Mode, req.Language)},
		},
	})
	if err != nil {
		return &ExplainDiffResponse{
			Provider: provider.Name,
			Model:    model,
			Error:    err.Error(),
		}, nil
	}

	return &ExplainDiffResponse{
		Explanation: strings.TrimSpace(answer),
		Provider:    provider.Name,
		Model:       model,
	}, nil
}

func (s *Service) StartAISetup(req AISetupRequest) error {
	state := s.setupState()
	state.mu.Lock()
	if state.running {
		state.mu.Unlock()
		return errors.New("setup already in progress")
	}
	state.running = true

	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = aiDefaultModel
	}
	ctx, cancel := context.WithCancel(context.Background())
	state.cancel = cancel
	state.progress = AISetupProgress{Phase: aiPhaseStarting, Model: model, Message: "Preparing local AI"}
	state.mu.Unlock()

	go s.runSetup(ctx, state, model)
	return nil
}

func (s *Service) AISetupProgressSnapshot() (*AISetupProgress, error) {
	state := s.setupState()
	snap := state.snapshot()
	return &snap, nil
}

func (s *Service) CancelAISetup() error {
	state := s.setupState()
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.cancel != nil {
		state.cancel()
	}
	return nil
}

func (s *Service) runSetup(ctx context.Context, state *aiSetupState, model string) {
	defer func() {
		state.mu.Lock()
		state.running = false
		state.mu.Unlock()
	}()

	client := aiclient.NewClient()
	baseURL := aiclient.DefaultOllamaBaseURL

	if !client.PingOllama(ctx, baseURL) {
		if !ollamaBinaryFound() {
			state.update(func(p *AISetupProgress) {
				p.Phase = aiPhaseError
				p.Error = "Ollama is not installed. Please install it from ollama.com first."
			})
			return
		}
		state.update(func(p *AISetupProgress) {
			p.Phase = aiPhaseStarting
			p.Message = "Starting Ollama daemon"
		})
		if err := startOllamaDaemon(); err != nil {
			state.update(func(p *AISetupProgress) {
				p.Phase = aiPhaseError
				p.Error = "Failed to start Ollama: " + err.Error()
			})
			return
		}
		state.update(func(p *AISetupProgress) {
			p.Phase = aiPhaseWaiting
			p.Message = "Waiting for Ollama to be ready"
		})
		if err := waitForOllama(ctx, client, baseURL, 25*time.Second); err != nil {
			state.update(func(p *AISetupProgress) {
				p.Phase = aiPhaseError
				p.Error = "Ollama did not become reachable: " + err.Error()
			})
			return
		}
	}

	state.update(func(p *AISetupProgress) {
		p.Phase = aiPhasePulling
		p.Message = "Downloading model"
	})

	err := client.PullOllamaModel(ctx, baseURL, model, func(progress aiclient.PullProgress) {
		var pct float64
		if progress.Total > 0 {
			pct = float64(progress.Completed) / float64(progress.Total) * 100
		}
		state.update(func(p *AISetupProgress) {
			p.Phase = aiPhasePulling
			p.Message = progress.Status
			p.PullCompleted = progress.Completed
			p.PullTotal = progress.Total
			p.PullPercent = pct
		})
	})
	if err != nil {
		state.update(func(p *AISetupProgress) {
			p.Phase = aiPhaseError
			p.Error = "Model download failed: " + err.Error()
		})
		return
	}

	state.update(func(p *AISetupProgress) {
		p.Phase = aiPhaseReady
		p.Message = "Ready"
		p.PullPercent = 100
	})
}

func waitForOllama(ctx context.Context, client *aiclient.Client, baseURL string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if err := ctx.Err(); err != nil {
			return err
		}
		if client.PingOllama(ctx, baseURL) {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}
	return fmt.Errorf("timed out after %s", timeout)
}

func ollamaBinaryFound() bool {
	if _, err := exec.LookPath("ollama"); err == nil {
		return true
	}
	if runtime.GOOS == "darwin" {
		if _, err := exec.LookPath("/Applications/Ollama.app/Contents/Resources/ollama"); err == nil {
			return true
		}
	}
	return false
}

func canAutoStartOllama() bool {
	switch runtime.GOOS {
	case "darwin", "linux":
		return ollamaBinaryFound()
	default:
		return false
	}
}

func startOllamaDaemon() error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", "-a", "Ollama").Run()
	case "linux":
		cmd := exec.Command("ollama", "serve")
		return cmd.Start()
	default:
		return fmt.Errorf("auto-start not supported on %s", runtime.GOOS)
	}
}

func buildExplainPrompt(diff, mode, language string) string {
	var b strings.Builder
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "json":
		b.WriteString("Mode: JSON value diff\n")
	case "directory":
		b.WriteString("Mode: directory diff\n")
	default:
		b.WriteString("Mode: text/code diff\n")
	}
	if lang := strings.TrimSpace(language); lang != "" {
		b.WriteString("Reply in: ")
		b.WriteString(lang)
		b.WriteString("\n")
	}
	b.WriteString("\nDiff:\n```\n")
	b.WriteString(diff)
	b.WriteString("\n```\n")
	return b.String()
}
