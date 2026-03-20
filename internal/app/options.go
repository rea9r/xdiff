package app

type Options struct {
	Format       string
	IgnorePaths  []string
	OnlyBreaking bool
	OldPath      string
	NewPath      string
}

type CompareOptions struct {
	Format       string
	IgnorePaths  []string
	OnlyBreaking bool
}

func (o Options) CompareOptions() CompareOptions {
	return CompareOptions{
		Format:       o.Format,
		IgnorePaths:  o.IgnorePaths,
		OnlyBreaking: o.OnlyBreaking,
	}
}
