package runner

type Options struct {
	Format       string
	FailOn       string
	IgnorePaths  []string
	OnlyBreaking bool
	UseColor     bool
	OldPath      string
	NewPath      string
}

type CompareOptions struct {
	Format       string
	FailOn       string
	IgnorePaths  []string
	OnlyBreaking bool
	UseColor     bool
}

func (o Options) CompareOptions() CompareOptions {
	return CompareOptions{
		Format:       o.Format,
		FailOn:       o.FailOn,
		IgnorePaths:  o.IgnorePaths,
		OnlyBreaking: o.OnlyBreaking,
		UseColor:     o.UseColor,
	}
}
