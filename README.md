# apidiff

API response diff tool written in Go.

## Usage

```bash
go run ./cmd/apidiff testdata/old.json testdata/new.json
```

Exit code:

- `0`: no differences
- `1`: differences found
- `2`: execution error
