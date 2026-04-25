package sample

import (
	"context"
	"errors"
	"time"
)

// App is the top-level glue for the sample workspace.
type App struct {
	timeout time.Duration
	name    string
}

// NewApp returns an App with a five second timeout.
func NewApp(name string) *App {
	return &App{
		timeout: 5 * time.Second,
		name:    name,
	}
}

// Run starts the app and blocks until ctx is cancelled.
func (a *App) Run(ctx context.Context) error {
	if a.name == "" {
		return errors.New("name required")
	}
	ctx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()
	<-ctx.Done()
	return ctx.Err()
}

// Name returns the configured app name.
func (a *App) Name() string {
	return a.name
}
