package desktopapi

import (
	"strings"
	"sync"

	"github.com/rea9r/xdiff/internal/output"
)

type Service struct {
	stateMu     sync.RWMutex
	stateStore  *desktopStateStore
	aiSetupOnce sync.Once
	aiSetup     *aiSetupState
}

type directoryEntrySnapshot struct {
	Path string
	Kind string
	Size int64
	Err  error
}

func NewService() *Service {
	store, err := newDesktopStateStore()
	if err != nil {
		return &Service{}
	}
	return &Service{stateStore: store}
}

func (s *Service) LoadDesktopState() (*DesktopState, error) {
	s.stateMu.RLock()
	defer s.stateMu.RUnlock()

	state := defaultDesktopState()
	if s.stateStore == nil {
		return &state, nil
	}
	loaded, err := s.stateStore.Load()
	if err != nil {
		return &state, nil
	}
	normalized := normalizeDesktopState(loaded)
	return &normalized, nil
}

func (s *Service) SaveDesktopState(req DesktopState) error {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()

	if s.stateStore == nil {
		return nil
	}
	return s.stateStore.Save(req)
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func pickDiffText(primary, fallback string) string {
	if strings.TrimSpace(primary) != "" {
		return primary
	}
	return fallback
}

func normalizeOutputFormat(v string) string {
	if v == "" {
		return output.TextFormat
	}
	return v
}
