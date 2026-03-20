package diff

type Summary struct {
	Added       int
	Removed     int
	Changed     int
	TypeChanged int
}

func Summarize(diffs []Diff) Summary {
	s := Summary{}
	for _, d := range diffs {
		switch d.Type {
		case Added:
			s.Added++
		case Removed:
			s.Removed++
		case Changed:
			s.Changed++
		case TypeChanged:
			s.TypeChanged++
		}
	}
	return s
}
