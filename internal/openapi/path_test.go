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

func TestParsePathRef_PathContainsMethodLikeToken_Operation(t *testing.T) {
	ref := operationPath("/users.get.v1", "post")

	raw := ref.raw()
	parsed, ok := parsePathRef(raw)
	if !ok {
		t.Fatal("expected parse success")
	}

	if parsed.apiPath != "/users.get.v1" {
		t.Fatalf("unexpected api path: %s", parsed.apiPath)
	}
	if parsed.method != "post" {
		t.Fatalf("unexpected method: %s", parsed.method)
	}
	if parsed.human() != "POST /users.get.v1" {
		t.Fatalf("unexpected human path: %s", parsed.human())
	}
}

func TestParsePathRef_PathEndsWithMethodLikeToken_Operation(t *testing.T) {
	ref := operationPath("/items.patch", "get")

	raw := ref.raw()
	parsed, ok := parsePathRef(raw)
	if !ok {
		t.Fatal("expected parse success")
	}

	if parsed.apiPath != "/items.patch" {
		t.Fatalf("unexpected api path: %s", parsed.apiPath)
	}
	if parsed.method != "get" {
		t.Fatalf("unexpected method: %s", parsed.method)
	}
	if parsed.human() != "GET /items.patch" {
		t.Fatalf("unexpected human path: %s", parsed.human())
	}
}

func TestParsePathRef_PathContainsMethodLikeToken_RequestBodyRequired(t *testing.T) {
	ref := requestBodyRequiredPath("/users.get.v1", "post")

	raw := ref.raw()
	parsed, ok := parsePathRef(raw)
	if !ok {
		t.Fatal("expected parse success")
	}

	if parsed.apiPath != "/users.get.v1" {
		t.Fatalf("unexpected api path: %s", parsed.apiPath)
	}
	if parsed.method != "post" {
		t.Fatalf("unexpected method: %s", parsed.method)
	}
	if parsed.human() != "POST /users.get.v1 request body required" {
		t.Fatalf("unexpected human path: %s", parsed.human())
	}
}

func TestParsePathRef_PathContainsMethodLikeToken_ResponseSchemaType(t *testing.T) {
	ref := responseSchemaTypePath("/items.patch", "get", "200", "application/json")

	raw := ref.raw()
	parsed, ok := parsePathRef(raw)
	if !ok {
		t.Fatal("expected parse success")
	}

	if parsed.apiPath != "/items.patch" {
		t.Fatalf("unexpected api path: %s", parsed.apiPath)
	}
	if parsed.method != "get" {
		t.Fatalf("unexpected method: %s", parsed.method)
	}
	if parsed.human() != "GET /items.patch response 200 application/json schema type" {
		t.Fatalf("unexpected human path: %s", parsed.human())
	}
}
