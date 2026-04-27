package runner

const (
	TextStyleAuto     = "auto"
	TextStylePatch    = "patch"
	TextStyleSemantic = "semantic"
)

type DiffOptions struct {
	Format           string
	IgnorePaths      []string
	IgnoreOrder      bool
	TextStyle        string
	IgnoreWhitespace bool
	IgnoreCase       bool
	IgnoreEOL        bool
}
