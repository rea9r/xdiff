package app

type Options struct {
	Format       string
	Scope        string
	View         string
	Summary      string
	IgnorePaths  []string
	OnlyBreaking bool
	NoColor      bool
	OldPath      string
	NewPath      string
}

type CompareOptions struct {
	Format       string
	Scope        string
	View         string
	Summary      string
	IgnorePaths  []string
	OnlyBreaking bool
	NoColor      bool
}

func (o Options) CompareOptions() CompareOptions {
	return CompareOptions{
		Format:       o.Format,
		Scope:        o.Scope,
		View:         o.View,
		Summary:      o.Summary,
		IgnorePaths:  o.IgnorePaths,
		OnlyBreaking: o.OnlyBreaking,
		NoColor:      o.NoColor,
	}
}
