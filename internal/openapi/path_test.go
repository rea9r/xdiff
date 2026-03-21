package openapi

import "testing"

func TestPathRefRoundTrip_Operation(t *testing.T) {
	ref := operationPath("/users", "post")

	raw := ref.raw()
	if raw != "paths./users.post" {
		t.Fatalf("unexpected raw path: %s", raw)
	}

	parsed, ok := parsePathRef(raw)
	if !ok {
		t.Fatal("expected parse success")
	}

	if parsed.human() != "POST /users" {
		t.Fatalf("unexpected human path: %s", parsed.human())
	}
}

func TestPathRefRoundTrip_RequestBodyRequired(t *testing.T) {
	ref := requestBodyRequiredPath("/users", "post")

	raw := ref.raw()
	if raw != "paths./users.post.requestBody.required" {
		t.Fatalf("unexpected raw path: %s", raw)
	}

	parsed, ok := parsePathRef(raw)
	if !ok {
		t.Fatal("expected parse success")
	}

	if parsed.human() != "POST /users request body required" {
		t.Fatalf("unexpected human path: %s", parsed.human())
	}
}

func TestPathRefRoundTrip_ResponseSchemaType(t *testing.T) {
	ref := responseSchemaTypePath("/users", "get", "200", "application/json")

	raw := ref.raw()
	if raw != "paths./users.get.responses.200.content.application/json.schema.type" {
		t.Fatalf("unexpected raw path: %s", raw)
	}

	parsed, ok := parsePathRef(raw)
	if !ok {
		t.Fatal("expected parse success")
	}

	if parsed.human() != "GET /users response 200 application/json schema type" {
		t.Fatalf("unexpected human path: %s", parsed.human())
	}
}

func TestPathRefRoundTrip_PathWithDot(t *testing.T) {
	ref := operationPath("/users.v1", "get")

	raw := ref.raw()
	parsed, ok := parsePathRef(raw)
	if !ok {
		t.Fatal("expected parse success")
	}

	if parsed.apiPath != "/users.v1" {
		t.Fatalf("unexpected api path: %s", parsed.apiPath)
	}
}
