package runner

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestRunWithValueLoaders_OldLoaderError(t *testing.T) {
	wantErr := errors.New("old load failed")

	code, out, err := RunJSONLoaders(
		func(context.Context) (any, error) { return nil, wantErr },
		func(context.Context) (any, error) { return map[string]any{}, nil },
		DiffOptions{Format: "text"},
	)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if !errors.Is(err, wantErr) {
		t.Fatalf("error mismatch: got=%v want=%v", err, wantErr)
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
}

func TestRunWithValueLoaders_NewLoaderError(t *testing.T) {
	wantErr := errors.New("new load failed")

	code, out, err := RunJSONLoaders(
		func(context.Context) (any, error) { return map[string]any{}, nil },
		func(context.Context) (any, error) { return nil, wantErr },
		DiffOptions{Format: "text"},
	)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if !errors.Is(err, wantErr) {
		t.Fatalf("error mismatch: got=%v want=%v", err, wantErr)
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
}

func TestRunWithValueLoaders_StartsBothLoadersConcurrently(t *testing.T) {
	oldStarted := make(chan struct{}, 1)
	newStarted := make(chan struct{}, 1)
	release := make(chan struct{})

	oldLoader := func(context.Context) (any, error) {
		oldStarted <- struct{}{}
		<-release
		return map[string]any{"value": 1}, nil
	}
	newLoader := func(context.Context) (any, error) {
		newStarted <- struct{}{}
		<-release
		return map[string]any{"value": 1}, nil
	}

	done := make(chan struct{})
	var (
		code int
		out  string
		err  error
	)
	go func() {
		code, out, err = RunJSONLoaders(oldLoader, newLoader, DiffOptions{
			Format: "text",
		})
		close(done)
	}()

	select {
	case <-oldStarted:
	case <-time.After(300 * time.Millisecond):
		t.Fatal("old loader did not start")
	}
	select {
	case <-newStarted:
	case <-time.After(300 * time.Millisecond):
		t.Fatal("new loader did not start concurrently")
	}

	close(release)

	select {
	case <-done:
	case <-time.After(1 * time.Second):
		t.Fatal("RunJSONLoaders did not finish")
	}

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != exitOK {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitOK)
	}
	if out != "No differences.\n" {
		t.Fatalf("unexpected output: %q", out)
	}
}

func TestRunWithValueLoaders_BothErrorsPreferOldError(t *testing.T) {
	oldErr := errors.New("old failed")
	newErr := errors.New("new failed")

	code, out, err := RunJSONLoaders(
		func(context.Context) (any, error) {
			time.Sleep(20 * time.Millisecond)
			return nil, oldErr
		},
		func(context.Context) (any, error) {
			return nil, newErr
		},
		DiffOptions{Format: "text"},
	)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if !errors.Is(err, oldErr) {
		t.Fatalf("expected old error, got: %v", err)
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
}

func TestRunWithValueLoaders_ReturnsOldErrorEarlyAndCancelsNewLoader(t *testing.T) {
	oldErr := errors.New("old failed")
	newStarted := make(chan struct{}, 1)
	newCanceled := make(chan struct{}, 1)

	oldLoader := func(context.Context) (any, error) {
		return nil, oldErr
	}
	newLoader := func(ctx context.Context) (any, error) {
		newStarted <- struct{}{}
		<-ctx.Done()
		newCanceled <- struct{}{}
		return nil, ctx.Err()
	}

	done := make(chan struct{})
	var (
		code int
		out  string
		err  error
	)
	go func() {
		code, out, err = RunJSONLoaders(oldLoader, newLoader, DiffOptions{
			Format: "text",
		})
		close(done)
	}()

	select {
	case <-newStarted:
	case <-time.After(300 * time.Millisecond):
		t.Fatal("new loader did not start")
	}

	select {
	case <-done:
	case <-time.After(300 * time.Millisecond):
		t.Fatal("RunJSONLoaders did not return early on old error")
	}

	if !errors.Is(err, oldErr) {
		t.Fatalf("expected old error, got: %v", err)
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}

	select {
	case <-newCanceled:
	case <-time.After(300 * time.Millisecond):
		t.Fatal("expected new loader to observe cancellation")
	}
}

func TestRunWithValueLoaders_NewFailsFirstOldFailsLater_ReturnsOldError(t *testing.T) {
	oldErr := errors.New("old failed")
	newErr := errors.New("new failed")

	code, out, err := RunJSONLoaders(
		func(context.Context) (any, error) {
			time.Sleep(80 * time.Millisecond)
			return nil, oldErr
		},
		func(context.Context) (any, error) {
			return nil, newErr
		},
		DiffOptions{Format: "text"},
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, oldErr) {
		t.Fatalf("expected old error precedence, got: %v", err)
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
}

func TestRunWithValueLoaders_NewFailsFirstOldSucceeds_ReturnsNewError(t *testing.T) {
	newErr := errors.New("new failed")

	code, out, err := RunJSONLoaders(
		func(context.Context) (any, error) {
			time.Sleep(80 * time.Millisecond)
			return map[string]any{"ok": true}, nil
		},
		func(context.Context) (any, error) {
			return nil, newErr
		},
		DiffOptions{Format: "text"},
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, newErr) {
		t.Fatalf("expected new error, got: %v", err)
	}
	if code != exitError {
		t.Fatalf("exit code mismatch: got=%d want=%d", code, exitError)
	}
	if out != "" {
		t.Fatalf("expected empty output on error, got: %q", out)
	}
}
