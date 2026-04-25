package sample

import (
	"context"
	"errors"
	"log/slog"
	"time"
)

// App is the top-level glue for the sample workspace.
type App struct {
	timeout time.Duration
	name    string
	logger  *slog.Logger
}

// NewApp returns an App with an eight second timeout.
func NewApp(name string, logger *slog.Logger) *App {
	return &App{
		timeout: 8 * time.Second,
		name:    name,
		logger:  logger,
	}
}

// Run starts the app and blocks until ctx is cancelled.
func (a *App) Run(ctx context.Context) error {
	if a.name == "" {
		return errors.New("name required")
	}
	if a.logger == nil {
		return errors.New("logger required")
	}
	ctx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()
	a.logger.Info("app starting", "name", a.name)
	<-ctx.Done()
	a.logger.Info("app stopped", "err", ctx.Err())
	return ctx.Err()
}

// Name returns the configured app name.
func (a *App) Name() string {
	return a.name
}
