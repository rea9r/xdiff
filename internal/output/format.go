package output

const (
	TextFormat = "text"
	JSONFormat = "json"
)

func IsSupportedFormat(format string) bool {
	return format == TextFormat || format == JSONFormat
}
