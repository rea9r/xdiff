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
	aiDefaultModel      = "gemma3:1b"
	aiDiffSnippetLimit  = 16000
	aiKeepAlive         = "30m"
	aiSystemInstruction = `You are a senior code reviewer. The user gives you a diff and you explain the changes for someone reviewing them.

INPUT FORMATS:
- Text/code mode: a single unified diff.
- JSON mode: structured diff lines (per JSON path additions, removals, type changes).
- Directory mode: a header line with file counts, followed by a sequence of per-file unified diffs in fenced "` + "```" + `diff" blocks (each block prefixed with "## changed: <path>"). Some files may be listed as added/removed by path only when their content is not shown.

LANGUAGE RULE (highest priority): the user message ends with a "Respond in: <language>" line. Your entire response — every sentence, heading, and bullet — must be written in that exact language. If it says Japanese, write Japanese (日本語). If it says English, write English. Never mix languages, never translate identifiers, never default back to English when the user asked for another language.

Output format:
- One short sentence summarizing the change.
- Bulleted list of the most important concrete changes (max 6 bullets). Quote identifier names where relevant. For directory mode, read each per-file unified diff and describe what changed inside the code (functions added/renamed, behavior shifts, signatures). Do NOT only restate file counts or list file names.
- A short "Watch out" line only if there is a real risk (breaking change, removed API, behavioral shift). Skip otherwise.

Be concise. Do not restate the diff verbatim.`
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
	return s.explainDiffInternal(req, nil, nil)
}

// ExplainDiffStream is identical to ExplainDiff except it invokes onChunk for
// each partial-token chunk the model emits and onThinking for each reasoning
// chunk emitted by thinking models. The returned response also contains the
// fully accumulated explanation, so callers may rely on either streaming or
// the final response.
func (s *Service) ExplainDiffStream(req ExplainDiffRequest, onChunk func(string), onThinking func(string)) (*ExplainDiffResponse, error) {
	return s.explainDiffInternal(req, onChunk, onThinking)
}

func (s *Service) explainDiffInternal(req ExplainDiffRequest, onChunk func(string), onThinking func(string)) (*ExplainDiffResponse, error) {
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

	// Disable thinking mode for reasoning models (qwen3, deepseek-r1, etc.).
	// Small models (e.g. qwen3.5:0.8b) frequently get stuck in repetitive
	// reasoning loops on diff explanation; bypassing the thinking step gives
	// a faster, more reliable answer. Older Ollama versions and non-reasoning
	// models simply ignore this field.
	noThink := false
	chatReq := aiclient.ChatRequest{
		Model: model,
		Messages: []aiclient.ChatMessage{
			{Role: "system", Content: aiSystemInstruction},
			{Role: "user", Content: buildExplainPrompt(diff, req.Mode, req.Language)},
		},
		KeepAlive: aiKeepAlive,
		Think:     &noThink,
	}

	var answer string
	if onChunk != nil || onThinking != nil {
		answer, err = client.ChatStream(ctx, *provider, chatReq, onChunk, onThinking)
	} else {
		answer, err = client.Chat(ctx, *provider, chatReq)
	}
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
	// cancel is stored on state and invoked by CancelAISetup or runSetup teardown.
	ctx, cancel := context.WithCancel(context.Background()) //nolint:gosec // cancel lifecycle managed by setupState
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

func (s *Service) DeleteOllamaModel(req DeleteOllamaModelRequest) error {
	model := strings.TrimSpace(req.Model)
	if model == "" {
		return errors.New("model is required")
	}
	client := aiclient.NewClient()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return client.DeleteOllamaModel(ctx, aiclient.DefaultOllamaBaseURL, model)
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

	agg := newPullAggregator()
	err := client.PullOllamaModel(ctx, baseURL, model, func(progress aiclient.PullProgress) {
		completed, total, pct := agg.observe(progress.Status, progress.Total, progress.Completed)
		state.update(func(p *AISetupProgress) {
			p.Phase = aiPhasePulling
			p.Message = progress.Status
			p.PullCompleted = completed
			p.PullTotal = total
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
	isDirectory := false
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "json":
		b.WriteString("Mode: JSON value diff\n")
	case "directory":
		b.WriteString("Mode: directory diff\n")
		isDirectory = true
	default:
		b.WriteString("Mode: text/code diff\n")
	}
	lang := strings.TrimSpace(language)
	if lang == "" {
		lang = "English"
	}
	b.WriteString("\nDiff:\n```\n")
	b.WriteString(diff)
	b.WriteString("\n```\n\n")
	if isDirectory {
		b.WriteString("Focus your bullets on what changed inside the per-file unified diffs (the bodies of each ```diff block). Do not just count files or list paths.\n\n")
	}
	b.WriteString(languageDirective(lang))
	return b.String()
}

func languageDirective(lang string) string {
	switch strings.ToLower(lang) {
	case "japanese", "ja", "日本語":
		return "Respond in: Japanese (日本語)\n" +
			"重要: 回答は必ず日本語で書いてください。要約・箇条書き・注意書きを含むすべての文を日本語で記述すること。英語で答えてはいけません。\n"
	default:
		return "Respond in: " + lang + "\n" +
			"Important: write every sentence of the response in " + lang + ". Do not switch languages.\n"
	}
}

// pullAggregator turns Ollama's per-layer pull progress into a single,
// monotonically-increasing percentage. Ollama streams `{status, total,
// completed}` frames where `total/completed` reset on each new layer
// (manifest, weights blob, config, template, …). Naively summing across
// layers still dips because a new layer's `total` enters the sum before
// any of its bytes have been pulled, so the percentage drops every time a
// layer is registered. The aggregator therefore also clamps the returned
// percentage to never regress.
type pullAggregator struct {
	totals     map[string]int64
	completeds map[string]int64
	lastPct    float64
}

func newPullAggregator() *pullAggregator {
	return &pullAggregator{
		totals:     map[string]int64{},
		completeds: map[string]int64{},
	}
}

// observe records a frame for the given status (e.g. "pulling <digest>") and
// returns the accumulated (completed, total, percent) across every layer seen
// so far. Status frames without a `total` (such as "verifying sha256 digest")
// are ignored so they do not perturb the running total. The returned percent
// is monotonically non-decreasing — when a newly-registered layer would dilute
// the cumulative ratio, the previous percent is kept instead.
func (a *pullAggregator) observe(status string, total, completed int64) (int64, int64, float64) {
	if total > 0 {
		if total > a.totals[status] {
			a.totals[status] = total
		}
		if completed > a.completeds[status] {
			a.completeds[status] = completed
		}
		if a.completeds[status] > a.totals[status] {
			a.completeds[status] = a.totals[status]
		}
	}
	var sumTotal, sumCompleted int64
	for _, t := range a.totals {
		sumTotal += t
	}
	for _, c := range a.completeds {
		sumCompleted += c
	}
	var pct float64
	if sumTotal > 0 {
		pct = float64(sumCompleted) / float64(sumTotal) * 100
	}
	if pct < a.lastPct {
		pct = a.lastPct
	} else {
		a.lastPct = pct
	}
	return sumCompleted, sumTotal, pct
}
