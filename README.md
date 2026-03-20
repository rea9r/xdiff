# apidiff

API response diff tool written in Go.

## Usage

```bash
go run ./cmd/apidiff testdata/old.json testdata/new.json
go run ./cmd/apidiff --format json testdata/old.json testdata/new.json
go run ./cmd/apidiff --ignore-path user.updated_at --ignore-path meta.request_id testdata/old.json testdata/new.json
go run ./cmd/apidiff --only-breaking testdata/old.json testdata/new.json
go run ./cmd/apidiff url --timeout 3s --header "Authorization: Bearer xxx" https://old.example.com/api https://new.example.com/api
```

Exit code:

- `0`: no differences
- `1`: differences found
- `2`: execution error

## Development Checks

```bash
go fmt ./...
go test ./...
go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.11.3 run --config=.golangci.yml
```
