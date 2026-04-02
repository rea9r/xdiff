package source

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestLoadJSONURL(t *testing.T) {
	var gotHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get("X-Test")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"user":{"name":"Taro"}}`))
	}))
	defer server.Close()

	got, err := LoadJSONURL(context.Background(), server.URL, HTTPOptions{
		Headers: []string{"X-Test: hello"},
		Timeout: time.Second,
	})
	if err != nil {
		t.Fatalf("LoadJSONURL returned error: %v", err)
	}

	if gotHeader != "hello" {
		t.Fatalf("header mismatch: got=%q want=%q", gotHeader, "hello")
	}

	obj, ok := got.(map[string]any)
	if !ok {
		t.Fatalf("result was not object: %#v", got)
	}
	user, ok := obj["user"].(map[string]any)
	if !ok {
		t.Fatalf("user was not object: %#v", obj["user"])
	}
	if user["name"] != "Taro" {
		t.Fatalf("name mismatch: got=%v want=%v", user["name"], "Taro")
	}
}

func TestLoadJSONURL_Non2xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	defer server.Close()

	_, err := LoadJSONURL(context.Background(), server.URL, HTTPOptions{})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestLoadJSONURL_InvalidHeader(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()

	_, err := LoadJSONURL(context.Background(), server.URL, HTTPOptions{
		Headers: []string{"InvalidHeader"},
	})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestLoadJSONURL_UsesNumber(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"age":20}`))
	}))
	defer server.Close()

	got, err := LoadJSONURL(context.Background(), server.URL, HTTPOptions{})
	if err != nil {
		t.Fatalf("LoadJSONURL returned error: %v", err)
	}

	obj := got.(map[string]any)
	if _, ok := obj["age"].(json.Number); !ok {
		t.Fatalf("age type mismatch: got=%T want=json.Number", obj["age"])
	}
}

func TestLoadJSONURL_UsesRequestContextCancellation(t *testing.T) {
	started := make(chan struct{}, 1)
	observedCancel := make(chan struct{}, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started <- struct{}{}
		<-r.Context().Done()
		observedCancel <- struct{}{}
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() {
		_, err := LoadJSONURL(ctx, server.URL, HTTPOptions{Timeout: 2 * time.Second})
		errCh <- err
	}()

	select {
	case <-started:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("request did not reach server")
	}

	cancel()

	select {
	case err := <-errCh:
		if err == nil {
			t.Fatal("expected cancellation error, got nil")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("LoadJSONURL did not return after cancellation")
	}

	select {
	case <-observedCancel:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("server did not observe request context cancellation")
	}
}

func TestLoadJSONURL_ResponseTooLarge(t *testing.T) {
	prev := maxJSONURLResponseBytes
	maxJSONURLResponseBytes = 1024
	t.Cleanup(func() {
		maxJSONURLResponseBytes = prev
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"payload":"` + strings.Repeat("x", 1100) + `"}`))
	}))
	defer server.Close()

	_, err := LoadJSONURL(context.Background(), server.URL, HTTPOptions{})
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "exceeds size limit") {
		t.Fatalf("expected size limit error, got: %v", err)
	}
}
