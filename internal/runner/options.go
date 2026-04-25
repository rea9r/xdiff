package runner

const (
	TextStyleAuto     = "auto"
	TextStylePatch    = "patch"
	TextStyleSemantic = "semantic"
)

type Options struct {
	CompareOptions
	OldPath string
	NewPath string
}

type CompareOptions struct {
	Format       string
	FailOn       string
	IgnorePaths  []string
	OnlyBreaking bool
	IgnoreOrder  bool
	TextStyle    string
	ShowPaths    bool
	UseColor     bool
}
