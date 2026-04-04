//go:build wailsbindings

package main

import "embed"

//go:embed frontend/index.html
var assets embed.FS
